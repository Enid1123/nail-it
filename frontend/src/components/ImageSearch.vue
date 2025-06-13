<template>
  <div class="flex flex-col items-center bg-white p-6 rounded-xl shadow hover:shadow-lg">
    <!-- 上傳區塊 -->
    <div 
      class="w-64 h-64 flex flex-col items-center justify-center border-2 border-dashed border-[#c68f84] rounded-xl cursor-pointer hover:bg-[#f3e4e1] transition mb-6"
      @click="$refs.fileInput.click()"
    >
      <input type="file" @change="handleUpload" class="hidden" ref="fileInput" />
      <div v-if="!uploadedImage" class="text-center text-[#c68f84]">
        點擊上傳照片
      </div>
      <div v-else>
        <img :src="uploadedImage" alt="Uploaded" class="w-full h-full object-cover rounded-xl" />
      </div>
    </div>

    <!-- 控制按鈕 -->
    <div v-if="uploadedImage" class="flex gap-4 mt-4">
      <button 
        @click="resetUpload"
        class="px-6 py-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 transition"
      >
        重置
      </button>
      <button 
        @click="searchSimilar"
        class="px-6 py-2 rounded-full bg-[#c68f84] text-white hover:bg-[#a96c60] transition"
      >
        搜尋
      </button>
    </div>

    <!-- Loading 狀態 -->
    <div v-if="isLoading" class="flex items-center justify-center mt-6">
      <svg class="animate-spin h-6 w-6 text-[#c68f84]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span class="ml-2 text-[#c68f84]">正在搜尋類似作品...</span>
    </div>
    <div v-if="errorMsg" class="text-red-600 mt-2">{{ errorMsg }}</div>
    
    <!-- 搜尋結果區 -->
    <div v-if="uploadedImage && similarWorks.length">
      <div class="flex items-center mt-6 mb-7">
    <h2 class="text-2xl text-gray-700 mt-4">找到類似的作品</h2>
    <img src="../assets/flower.png" alt="Flower" class="w-10 h-auto" /> 
  </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <div
          v-for="work in similarWorks"
          :key="work.id"
          class="bg-white p-4 rounded-xl shadow hover:shadow-lg cursor-pointer"
          @click="goToProfile(work.artistId)"
        >
          <img :src="work.image" class="w-full h-48 object-cover rounded-md mb-3" />
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-[#c68f84]">{{ work.studio }}</h3>
            <p class="text-[#dcb876] text-sm">★ {{ work.rating }}</p>
          </div>
          <p class="text-gray-500 text-sm mb-2">$ {{ work.priceLow }}-{{ work.priceHigh }}</p>
          <div class="mb-2">
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="(tag, index) in work.tags" 
                :key="index" 
                class="bg-[#c68f84] text-white text-xs py-1 px-3 rounded-full"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>



<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const uploadedFile = ref(null)        // 暫存原始 file
const uploadedImage = ref(null)       // 圖片預覽
const similarWorks = ref([])          // 類似作品結果
const isLoading = ref(false)
const errorMsg = ref('')               // 錯誤訊息

const resetUpload = () => {
  uploadedFile.value = null
  uploadedImage.value = null
  similarWorks.value = []
  isLoading.value = false
  errorMsg.value = ''
}

const router = useRouter()

// 跳轉到 profile 頁面
const goToProfile = (artistId) => {
  if (!artistId) {
    console.warn('⚠️ 無法跳轉：沒有 artistId')
    return
  }
  router.push(`/profile/${artistId}`)
}


import { API_BASE_URL } from '../config/api.js'

// const sortedDesign = computed(() => {
//   return [...design].sort((a, b) => b.rating - a.rating)
// })


const handleUpload = (e) => {
  const file = e.target.files[0]
  if (file) {
    uploadedFile.value = file
    uploadedImage.value = URL.createObjectURL(file)
    similarWorks.value = []         // 清空結果
    errorMsg.value = ''
  }
}

const searchSimilar  = async () => {
  if (!uploadedFile.value) return

  isLoading.value = true
  try {
    // 轉成 base64 字串
    const base64 = await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(uploadedFile.value)
    })

    const resp = await fetch(`${API_BASE_URL}/search-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: base64 })
    })

    const data = await resp.json()
    if (resp.ok && data.success) {
      similarWorks.value = Array.isArray(data.results) ? data.results : []
      errorMsg.value = ''
    } else if (data && data.error === 'no nails detected') {
      resetUpload()
      errorMsg.value = '❗ 請上傳含有指甲的照片'
      similarWorks.value = []
    } else {
      console.error('search-image failed', data.error)
      similarWorks.value = []
      errorMsg.value = '搜尋失敗'
    }
  } catch (err) {
    console.error('search-image error', err)
    similarWorks.value = []
    errorMsg.value = '搜尋失敗'
  }
  isLoading.value = false
}
</script>
