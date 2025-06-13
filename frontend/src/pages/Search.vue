<!-- Search.vue -->
<template>
  <div class="min-h-screen flex flex-col bg-[#efddda]" @click="closeMenu">
    <!-- Navbar -->
    <div class="relative bg-[#efddda] p-3 shadow-md w-full">
      <!-- 左右貼邊的容器 -->
      <div class="flex items-center justify-between px-4">
        <!-- 左：漢堡 -->
        <button @click.stop="toggleMenu" class="text-[#c68f84] text-4xl">&#9776;</button>

        <!-- 右：頭像 點擊回到自己的 profile-->
        <div 
          @click="goToSelfProfile" 
          class="w-10 h-10 bg-[#c68f84] rounded-full cursor-pointer hover:bg-[#c67868] transition-colors">
        </div>
      </div>

      <!-- 中間：Logo（置中） -->
      <div class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <img 
          src="../assets/logo.png" 
          alt="Logo" 
          class="w-52 h-auto cursor-pointer" 
          @click="router.push('/home')" 
        />
      </div>
    </div>

    <!-- 左側選單 -->
    <div v-if="showMenu" class="fixed top-7 left-0 w-48 h-auto bg-white shadow-lg p-6 z-50" @click.stop>
      <ul class="space-y-4">
        <li><a @click="goToSelfProfile" class="hover:text-[#c68f84] cursor-pointer">個人檔案</a></li>
        <li><router-link to="/chat" class="hover:text-[#c68f84]">聊聊</router-link></li>
        <li><router-link to="/appointments" class="hover:text-[#c68f84]">預約紀錄</router-link></li>
        <li><router-link to="/reviews" class="hover:text-[#c68f84]">評分紀錄</router-link></li>
        <li><router-link to="/settings" class="hover:text-[#c68f84]">隱私設定</router-link></li>
        <li><a @click="handleLogout" class="hover:text-[#c68f84] cursor-pointer">登出</a></li>
      </ul>
    </div>

    <!-- 內容區域 (增加適當的 padding) -->
    <div class="flex-1 px-4 py-6">
      <!-- Tabs 區塊 -->
      <div class="flex justify-center mb-6">
        <div class="flex space-x-6 border-b border-[#c68f84]">
          <button @click="activeTab = 'name'" :class="tabClass('name')">以名稱搜尋</button>
          <button @click="activeTab = 'image'" :class="tabClass('image')">以圖搜尋</button>
          <button @click="activeTab = 'filter'" :class="tabClass('filter')">以條件搜尋</button>
        </div>
      </div>

      <!-- 卡片包裹內容 -->
      <div class="bg-white rounded-2xl shadow p-6">
        <!-- 名稱搜尋區塊 - 美甲師頭像卡片 -->
        <div v-if="activeTab === 'name'">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
            <div class="flex flex-1 items-center space-x-4">
              <input 
                v-model="searchName" 
                @keyup.enter="searchByName" 
                placeholder="搜尋美甲師名稱..."
                class="flex-1 border p-2 rounded-lg border-[#c68f84] focus:ring-2 focus:ring-[#c68f84]" 
              />
              <button 
                @click="searchByName" 
                class="bg-[#c68f84] text-white px-4 py-2 rounded-lg hover:bg-[#c67868]"
              >
                搜尋
              </button>
            </div>
          </div>

          <!-- 搜尋結果 -->
          <div v-if="searchResult.length > 0">
            <h2 class="text-2xl text-gray-600 mb-4">搜尋結果</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div 
                v-for="artist in searchResult" 
                :key="artist.id" 
                class="bg-white p-4 rounded-xl shadow hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                @click="router.push(`/profile/${artist.id}`)"
              >
                <!-- 頭像 - 使用與 Profile.vue 相同的風格 -->
                <div class="avatar-container w-24 h-24 rounded-full mx-auto mb-3 overflow-hidden relative" style="background-color: #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                  <img 
                    :src="artist.image" 
                    alt="" 
                    class="w-full h-full object-cover" 
                    @error="handleArtistImageError($event, artist)"
                    v-show="!artist.showFallback"
                  />
                  <!-- 默認頭像 -->
                  <div v-if="artist.showFallback" class="absolute inset-0 flex items-center justify-center">
                    <svg width="100" height="100" viewBox="0 0 100 100" class="w-30 h-30" fill="none" stroke="#c68f84" stroke-width="4">
                      <circle cx="50" cy="35" r="15" />
                      <path d="M20,85 C20,60 80,60 80,85" />
                    </svg>
                  </div>
                </div>
                
                <!-- 工作室名稱 -->
                <h3 class="text-xl text-gray-600 text-center">{{ artist.studio }}</h3>
                
                <!-- 評分 -->
                <div class="flex items-center justify-center mt-1 text-[#dcb876]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <span>{{ artist.rating }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 無搜尋結果時 -->
          <div v-else-if="hasSearched" class="text-center py-8">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-gray-500 mb-4">沒有找到符合「{{ searchName }}」的美甲師</p>
            <button 
              @click="clearSearch" 
              class="text-[#c68f84] hover:underline"
            >
              清除搜尋
            </button>
          </div>
          
          <!-- 初始狀態 -->
          <div v-else class="text-center py-8">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p class="text-gray-500">輸入美甲師名稱開始搜尋</p>
          </div>
        </div>

        <!-- 以圖搜尋 -->
        <ImageSearch v-if="activeTab === 'image'" />

        <!-- 以條件搜尋 -->
        <FilterSearch v-if="activeTab === 'filter'" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ImageSearch from '../components/ImageSearch.vue'
import FilterSearch from '../components/FilterSearch.vue'
import { useLogout } from '../auth.js'
import { API_BASE_URL } from '../config/api.js'

const { handleLogout } = useLogout()

// 使用 router
const router = useRouter()

// 前往自己的個人檔案
const goToSelfProfile = () => {
  // 判斷用戶類型
  const userType = localStorage.getItem('userType') || 'artist'
  const userId = localStorage.getItem('userId') || '1'
  
  if (userType === 'customer') {
    router.push(`/profile/customer/${userId}`)
  } else {
    router.push(`/profile/${userId}`)
  }
}

const showMenu = ref(false)

const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

// 點其他地方要關掉選單
const closeMenu = (event) => {
  if (!event.target.closest('.fixed') && showMenu.value) {
    showMenu.value = false
  }
}

const activeTab = ref('name') // 預設顯示名稱搜尋
const searchName = ref('')
const searchResult = ref([])
const hasSearched = ref(false) // 追蹤是否已進行過搜尋

const tabClass = (tab) => {
  return [
    'px-4 py-2 border-b-2 transition-colors duration-200',
    activeTab.value === tab
      ? 'border-[#c68f84] text-[#c68f84]'
      : 'border-transparent text-gray-500 hover:text-[#c68f84]'
  ]
}

const searchByName = async () => {
  if (searchName.value.trim() === '') {
    searchResult.value = [];
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/search-artists?studioName=${encodeURIComponent(searchName.value.trim())}`);

    if (!response.ok) {
      throw new Error(`伺服器錯誤: ${response.status}`);
    }

    const result = await response.json();
    console.log('搜尋結果', result);

    searchResult.value = result.results.map(item => ({
      id: item.id,
      studio: item.studioName,
      rating: item.rating,
      image: item.avatarUrl,
      showFallback: false
    }));

  } catch (err) {
    console.error('搜尋失敗:', err);
    searchResult.value = [];
  }
  hasSearched.value = true;
};



const clearSearch = () => {
  searchName.value = ''
  searchResult.value = []
  hasSearched.value = false
}

// 處理美甲師頭像載入錯誤
const handleArtistImageError = (event, artist) => {
  artist.showFallback = true
}

// 初始載入時顯示所有美甲師（取消註釋下面的代碼，如果希望一開始就顯示所有美甲師）
onMounted(() => {
  // searchResult.value = [...allArtists]
})
</script>

<style scoped>
.avatar-container {
  position: relative;
}

.avatar-fallback {
  position: absolute;
  top: 0;
  left: 0;
}

/* 輸入框focus效果 */
input:focus {
  outline: none;
}
</style>