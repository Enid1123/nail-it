#!/bin/bash

# 設置顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}開始更新 Docker 容器...${NC}"

# 切換到專案目錄
cd "$(dirname "$0")"

# 拉取最新的代碼
echo -e "${BLUE}從 GitHub 拉取最新代碼...${NC}"
git pull

# 檢測環境變數 (可由 CI/CD 系統設置)
ENVIRONMENT=${ENVIRONMENT:-"development"}
echo -e "${BLUE}部署環境: ${GREEN}$ENVIRONMENT${NC}"

# 取得當前的 Git 資訊
GIT_COMMIT=$(git rev-parse --short HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${BLUE}當前 commit: ${GREEN}$GIT_COMMIT${NC}"
echo -e "${BLUE}當前分支: ${GREEN}$GIT_BRANCH${NC}"

# 獲取版本信息 (從 package.json 或其他配置文件)
# 如果沒有版本文件，可以使用遞增版本號方式
VERSION_FILE=".version"
if [ -f "package.json" ]; then
  VERSION=$(grep -o '"version": *"[^"]*"' package.json | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
elif [ -f "$VERSION_FILE" ]; then
  VERSION=$(cat "$VERSION_FILE")
else
  VERSION="1.0.0"
  echo "$VERSION" > "$VERSION_FILE"
  echo -e "${YELLOW}創建新版本文件，初始版本為 $VERSION${NC}"
fi

echo -e "${BLUE}版本號: ${GREEN}$VERSION${NC}"

# 創建日期標記
DATE_TAG=$(date +"%Y%m%d")

# 創建多種標籤策略
SEMANTIC_TAG="nail-it-frontend:v$VERSION"
ENVIRONMENT_TAG="nail-it-frontend:$ENVIRONMENT"
GIT_TAG="nail-it-frontend:$GIT_BRANCH-$GIT_COMMIT"
DATE_TAG="nail-it-frontend:$DATE_TAG"
LATEST_TAG="nail-it-frontend:latest"

# 如果是主分支，且環境是生產環境，則標記為穩定版
if [ "$GIT_BRANCH" = "main" ] || [ "$GIT_BRANCH" = "master" ]; then
  if [ "$ENVIRONMENT" = "production" ]; then
    STABLE_TAG="nail-it-frontend:stable"
    ADDITIONAL_TAGS="-t $STABLE_TAG"
    echo -e "${BLUE}標記為穩定版本${NC}"
  fi
fi

# 構建 Docker 映像並應用所有標籤
echo -e "${BLUE}重新構建前端 Docker 映像...${NC}"
docker build \
  -t $SEMANTIC_TAG \
  -t $ENVIRONMENT_TAG \
  -t $GIT_TAG \
  -t $DATE_TAG \
  -t $LATEST_TAG \
  $ADDITIONAL_TAGS \
  --build-arg GITHUB_SHA=$GIT_COMMIT \
  --build-arg VERSION=$VERSION \
  --build-arg ENVIRONMENT=$ENVIRONMENT \
  -f frontend/Dockerfile ./frontend

echo -e "${BLUE}創建了映像標籤:${NC}"
echo -e "${GREEN}- 語義化版本: $SEMANTIC_TAG${NC}"
echo -e "${GREEN}- 環境標識: $ENVIRONMENT_TAG${NC}"
echo -e "${GREEN}- Git 相關: $GIT_TAG${NC}"
echo -e "${GREEN}- 日期標識: $DATE_TAG${NC}"
echo -e "${GREEN}- 最新版本: $LATEST_TAG${NC}"
if [ -n "$STABLE_TAG" ]; then
  echo -e "${GREEN}- 穩定版本: $STABLE_TAG${NC}"
fi

# 停止舊容器（如果在運行）
echo -e "${BLUE}停止舊容器（如果存在）...${NC}"
CONTAINER_NAME="nail-it-frontend-$ENVIRONMENT"
docker stop $CONTAINER_NAME || true
docker rm $CONTAINER_NAME || true

# 啟動新容器
echo -e "${BLUE}啟動新容器...${NC}"
docker run -d --name $CONTAINER_NAME -p 80:80 $ENVIRONMENT_TAG

echo -e "${GREEN}更新完成！新容器已啟動在 http://localhost${NC}"
echo -e "${GREEN}映像標籤列表：${NC}"
docker images | grep nail-it-frontend