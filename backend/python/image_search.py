import argparse
import os
import io
import json

# avoid OpenMP runtime conflicts on Windows
os.environ.setdefault('KMP_DUPLICATE_LIB_OK', 'TRUE')

import numpy as np
import cv2
from PIL import Image
from supabase import create_client
import faiss
import torch
from torchvision import transforms
from torchvision.transforms import InterpolationMode
import timm
from ultralytics import YOLO

HIST_BINS = 181
HIST_TOPK = 2
COLOR_SCALE = 60


def get_color_features(arr_rgb: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(arr_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    meanL, meana, meanb = lab.mean(axis=(0, 1))
    lab_feat = np.array([meanL / 100.0, (meana + 128) / 255.0, (meanb + 128) / 255.0], dtype=np.float32)

    hsv = cv2.cvtColor(arr_rgb, cv2.COLOR_RGB2HSV)
    hue_arr = hsv[:, :, 0].flatten()
    counts = np.bincount(hue_arr, minlength=HIST_BINS)
    topk_idx = np.argsort(counts)[-HIST_TOPK:]
    hue_feat = topk_idx.astype(np.float32) / 180.0

    return np.concatenate([lab_feat, hue_feat])


def get_avg_feat(pil_img, model, transform, device):
    inp = transform(pil_img).unsqueeze(0).to(device)
    with torch.no_grad():
        out = model.forward_features(inp)
    tokens = out["x_norm_patchtokens"] if isinstance(out, dict) else out[:, 1:, :]
    v = tokens.mean(dim=1).cpu().numpy().ravel()
    return v / (np.linalg.norm(v) + 1e-8)


def load_models():
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = timm.create_model('vit_small_patch14_dinov2.lvd142m', pretrained=True)
    model = model.to(device).eval()
    transform = transforms.Compose([
        transforms.Resize((518, 518), interpolation=InterpolationMode.BICUBIC),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    yolo_path = os.path.join(os.path.dirname(__file__), '../models/nails_seg_s_yolov8_v1.pt')
    yolo = YOLO(yolo_path)
    return device, model, transform, yolo


def extract(args):
    supabase = create_client(args.supabase_url, args.supabase_key)
    device, model, transform, yolo = load_models()
    img_bgr = cv2.imread(args.image_path)
    res = yolo(img_bgr)[0]
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    batch = []
    for i, box in enumerate(res.boxes.xyxy):
        x1, y1, x2, y2 = map(int, box.tolist())
        roi = img_rgb[y1:y2, x1:x2]
        if roi.size == 0:
            continue
        pil_roi = Image.fromarray(roi)
        feat_vis = get_avg_feat(pil_roi, model, transform, device)
        color_feat = get_color_features(roi)
        feat = np.concatenate([feat_vis, color_feat * COLOR_SCALE]).astype('float32')
        key = f"{args.image_id}_{i}.png"
        with io.BytesIO() as buf:
            Image.fromarray(roi).save(buf, format='PNG')
            buf.seek(0)
            supabase.storage.from_('roi').upload(key, buf.read(), {"content-type": "image/png", "upsert": "true"})
        batch.append({
            "nail_image_id": args.image_id,
            "roi_index": i,
            "embedding": feat.tolist()
        })
    if batch:
        supabase.table('nail_roi_embeddings').insert(batch).execute()


def search(args):
    supabase = create_client(args.supabase_url, args.supabase_key)
    device, model, transform, yolo = load_models()

    # fetch all embeddings
    rows = supabase.table('nail_roi_embeddings').select('nail_image_id, embedding').execute().data
    if not rows:
        print(json.dumps([]))
        return
    ids = []
    vectors = []
    for r in rows:
        vec = r['embedding']
        if isinstance(vec, str):
            try:
                vec = json.loads(vec)
            except Exception:
                vec = [float(x) for x in vec.strip('{}[]').split(',') if x]
        ids.append(r['nail_image_id'])
        vectors.append(vec)
    embeddings = np.stack(vectors).astype('float32')
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    img_bgr = cv2.imread(args.image_path)
    res = yolo(img_bgr)[0]
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    votes = {}
    for box in res.boxes.xyxy:
        x1, y1, x2, y2 = map(int, box.tolist())
        roi = img_rgb[y1:y2, x1:x2]
        if roi.size == 0:
            continue
        pil_roi = Image.fromarray(roi)
        feat_vis = get_avg_feat(pil_roi, model, transform, device)
        color_feat = get_color_features(roi)
        feat = np.concatenate([feat_vis, color_feat * COLOR_SCALE]).astype('float32')
        _, I = index.search(feat.reshape(1, -1), 100)
        for rank, idx in enumerate(I[0]):
            img_id = ids[idx]
            votes[img_id] = votes.get(img_id, 0) + 1.0 / (rank + 1)

    if not votes:
        print(json.dumps([]))
        return

    top_ids = sorted(votes, key=votes.get, reverse=True)[:args.topk]
    # map to image urls
    data = supabase.table('nail_images').select('id, artist_id, image_url').in_('id', top_ids).execute().data
    id2info = {d['id']: d for d in data}
    result = [
        {
            'id': i,
            'artist_id': id2info[i]['artist_id'],
            'image_url': id2info[i]['image_url']
        }
        for i in top_ids if i in id2info
    ]
    print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='cmd')

    p_ext = sub.add_parser('extract')
    p_ext.add_argument('image_path')
    p_ext.add_argument('image_id')
    p_ext.add_argument('--supabase-url', required=True)
    p_ext.add_argument('--supabase-key', required=True)

    p_s = sub.add_parser('search')
    p_s.add_argument('image_path')
    p_s.add_argument('--topk', type=int, default=5)
    p_s.add_argument('--supabase-url', required=True)
    p_s.add_argument('--supabase-key', required=True)

    args = parser.parse_args()
    if args.cmd == 'extract':
        extract(args)
    elif args.cmd == 'search':
        search(args)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
