<!-- Booking.vue -->
<template>
  <div class="p-4">
    <!-- 檢查美甲師是否已設定時段 -->
    <div v-if="!hasAvailableSchedule" class="text-center py-12">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="text-xl font-medium text-gray-700 mb-2">暫時無法預約</h3>
      <p class="text-gray-600 mb-4">{{ artistName }} 尚未設定營業時段</p>
      <p class="text-sm text-gray-600 mb-6">請稍後再試，或透過「聊聊」功能直接聯繫美甲師</p>
      <button @click="$emit('close')" class="px-6 py-2 bg-[#c68f84] text-white rounded-lg hover:bg-[#c67868]">
        關閉
      </button>
    </div>

    <!-- 有設定時段才顯示預約表單 -->
    <div v-else-if="!showSuccess">
      <h2 class="text-2xl text-gray-700 font-bold mb-6">預約 {{ artistName }}</h2>

      <form @submit.prevent="submitBooking" class="space-y-6">
        <div>
          <label class="block text-gray-700 mb-2">選擇日期</label>
          <!-- 使用日期選擇组件 -->
          <div class="date-selector border rounded-lg p-4">
            <!-- 月份顯示 -->
            <div class="flex justify-between items-center mb-4">
              <button 
                @click="changeMonth(-1)" 
                class="text-gray-500 hover:text-gray-700"
                :disabled="!canGoToPrevMonth"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 class="text-lg font-medium">{{ currentMonthName }} {{ currentYear }}</h3>
              <button 
                @click="changeMonth(1)" 
                class="text-gray-500 hover:text-gray-700"
                :disabled="!canGoToNextMonth"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            <!-- 星期標題 -->
            <div class="grid grid-cols-7 gap-2 mb-2 text-center">
              <div v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="text-sm font-medium">
                {{ day }}
              </div>
            </div>
            
            <!-- 日期網格 -->
            <div class="grid grid-cols-7 gap-2">
              <div v-for="n in firstDayOfMonth" :key="`empty-${n}`" class="text-center py-2"></div>
              
              <!-- 實際日期 -->
              <div
                v-for="dateObj in daysInCurrentMonth"
                :key="dateObj.dateString"
                class="text-center py-2 rounded cursor-pointer text-sm relative"
                :class="{
                  'bg-[#f3d7d3] text-[#c67868] font-bold': dateObj.dateString === selectedDate,
                  'bg-gray-100 text-gray-400 cursor-not-allowed': !dateObj.available,
                  'hover:bg-[#f9e7e4]': dateObj.available && dateObj.dateString !== selectedDate,
                  'opacity-50': dateObj.isPastDate
                }"
                @click="!dateObj.isPastDate && dateObj.available && selectDate(dateObj.dateString)"
              >
                {{ dateObj.day }}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-gray-700 mb-2">選擇時間</label>
          <div v-if="availableTimeSlots.length > 0" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              v-for="timeSlot in availableTimeSlots"
              :key="timeSlot.time"
              type="button"
              class="text-center py-2 px-3 rounded text-sm border border-gray-200"
              :class="{
                'bg-[#f3d7d3] text-[#c67868] font-bold border-[#c67868]': timeSlot.time === selectedTime,
                'bg-gray-100 text-gray-400 cursor-not-allowed': !timeSlot.available,
                'hover:bg-[#f9e7e4]': timeSlot.available && timeSlot.time !== selectedTime
              }"
              :disabled="!timeSlot.available"
              @click="timeSlot.available && selectTime(timeSlot.time)"
            >
              {{ timeSlot.time }}
            </button>
          </div>
          <div v-else class="text-gray-500 text-center py-4">
            請先選擇日期以查看可用時段
          </div>
        </div>

        <div>
          <label class="block text-gray-700 mb-2">備註（可選）</label>
          <textarea v-model="notes" class="border p-2 w-full rounded-lg" rows="4" placeholder="例如：想做法式、希望偏粉色系..."></textarea>
        </div>

        <div class="flex gap-2">
          <button type="button" @click="$emit('close')" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
            取消
          </button>
          <button type="submit" class="flex-1 bg-[#c68f84] text-white py-2 rounded-lg hover:bg-[#c67868]" :disabled="!selectedDate || !selectedTime">
            送出預約
          </button>
        </div>
      </form>
    </div>

    <!-- 預約成功提示 -->
    <div v-if="showSuccess" class="bg-white rounded-xl p-6 max-w-md mx-auto text-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-[#c68f84] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <h3 class="text-xl font-bold mb-2">預約成功！</h3>
      <p class="mb-4">您已成功申請預約 {{ artistName }} 的服務，請稍待美甲師確認</p>
      <p class="text-gray-700 mb-4">
        日期：{{ formatDisplayDate(selectedDate) }}<br>
        時間：{{ selectedTime }}<br>
        備註：{{ notes || '無' }}
      </p>
      <button @click="finishBooking" class="px-6 py-2 bg-[#c68f84] text-white rounded hover:bg-[#c67868]">
        確定
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const emit = defineEmits(['close'])

// 接收 artist-id 和 weekly-schedule
const props = defineProps({
  artistId: {
    type: String,
    required: true
  },
  weeklySchedule: {
    type: Object,
    default: () => ({
      monday: { isOpen: true, timeSlots: ['10:00-12:00', '14:00-16:00', '16:00-18:00'] },
      tuesday: { isOpen: true, timeSlots: ['10:00-12:00', '14:00-16:00', '16:00-18:00'] },
      wednesday: { isOpen: true, timeSlots: ['10:00-12:00', '14:00-16:00', '16:00-18:00'] },
      thursday: { isOpen: true, timeSlots: ['10:00-12:00', '14:00-16:00', '16:00-18:00'] },
      friday: { isOpen: true, timeSlots: ['10:00-12:00', '14:00-16:00', '16:00-18:00'] },
      saturday: { isOpen: true, timeSlots: ['10:00-12:00', '14:00-16:00'] },
      sunday: { isOpen: false, timeSlots: [] }
    })
  }
})

const artistName = ref('')
const selectedDate = ref('')
const selectedTime = ref('')
const notes = ref('')
const showSuccess = ref(false)

// 日曆相關狀態
const currentDate = ref(new Date())
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())
const currentMonthName = computed(() => {
  const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  return months[currentMonth.value]
})

// 計算當前月的第一天是星期幾
const firstDayOfMonth = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1).getDay()
  return firstDay
})

// 當前月份的天數 - 根據美甲師時段設定
const daysInCurrentMonth = computed(() => {
  const daysInMonth = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0) 
  
  const days = []
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentYear.value, currentMonth.value, i)
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    
    // 獲取星期幾
    const dayOfWeek = date.getDay()
    const dayName = dayNames[dayOfWeek]
    
    // 檢查是否是過去的日期
    const isPastDate = date < today
    
    // 根據美甲師設定的時段判斷是否可預約
    const daySchedule = props.weeklySchedule[dayName]
    const isAvailable = daySchedule && daySchedule.isOpen && daySchedule.timeSlots.length > 0 && !isPastDate
    
    days.push({
      date: date,
      dateString: dateString,
      day: i,
      available: isAvailable,
      isPastDate: isPastDate,
      dayName: dayName
    })
  }
  
  return days
})

// 是否可以切換到上個月（不能選擇過去的月份）
const canGoToPrevMonth = computed(() => {
  const today = new Date()
  const prevMonth = new Date(currentYear.value, currentMonth.value - 1)
  return prevMonth.getMonth() >= today.getMonth() || prevMonth.getFullYear() > today.getFullYear()
})

// 是否可以切換到下個月（限制最多只能預約3個月內）
const canGoToNextMonth = computed(() => {
  const today = new Date()
  const nextMonth = new Date(currentYear.value, currentMonth.value + 1)
  const threeMonthsLater = new Date(today.getFullYear(), today.getMonth() + 3)
  return nextMonth < threeMonthsLater
})

// 切換月份
const changeMonth = (delta) => {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + delta)
  currentDate.value = newDate
  // 切換月份時清空選擇
  selectedDate.value = ''
  selectedTime.value = ''
}

// 可用時間段
const availableTimeSlots = ref([])

// 檢查美甲師是否有設定可用時段
const hasAvailableSchedule = computed(() => {
  if (!props.weeklySchedule) return false
  
  // 檢查是否至少有一天營業且有時段
  return Object.values(props.weeklySchedule).some(day => 
    day.isOpen && day.timeSlots && day.timeSlots.length > 0
  )
})

// 根據選擇的日期更新可用時段(模擬)
/*
const updateTimeSlotAvailability = (dateString) => {
  const dateObj = new Date(dateString)
  const dayOfWeek = dateObj.getDay()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = dayNames[dayOfWeek]
  
  // 根據美甲師設定的時段更新可用時間
  const daySchedule = props.weeklySchedule[dayName]
  
  if (daySchedule && daySchedule.isOpen && daySchedule.timeSlots.length > 0) {
    // 更新時間選項為美甲師設定的時段
    availableTimeSlots.value = daySchedule.timeSlots.map(slot => ({
      time: slot,
      available: true
    }))
    
    // 模擬一些時段已被預約
    const occupiedSlots = getOccupiedSlots(dateString)
    availableTimeSlots.value.forEach(slot => {
      if (occupiedSlots.includes(slot.time)) {
        slot.available = false
      }
    })
  } else {
    // 如果不營業，清空可用時段
    availableTimeSlots.value = []
  }
}
*/

//串api
const updateTimeSlotAvailability = async (dateString) => {
  const dateObj = new Date(dateString);
  const dayOfWeek = dateObj.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];
  const daySchedule = props.weeklySchedule[dayName];

  if (daySchedule && daySchedule.isOpen && daySchedule.timeSlots.length > 0) {
    const occupiedSlots = await getOccupiedSlots(dateString);

    availableTimeSlots.value = daySchedule.timeSlots.map(slot => ({
      time: slot,
      available: !occupiedSlots.includes(slot)
    }));
  } else {
    availableTimeSlots.value = [];
  }
};


// 獲取已預約時段的函數（模擬）
/*
const getOccupiedSlots = (dateString) => {
  // 這裡應該從後端 API 獲取已預約的時段
  // 目前用模擬資料
  const occupied = {
    // 模擬某些日期的已預約時段
  }
  
  // 簡單模擬：隨機讓某些時段不可用
  const date = new Date(dateString)
  const day = date.getDate()
  
  if (day % 7 === 0) {
    return ['10:00-12:00'] // 模擬每月7, 14, 21, 28號的10:00-12:00已被預約
  } else if (day % 5 === 0) {
    return ['14:00-16:00'] // 模擬每月5, 10, 15, 20, 25, 30號的14:00-16:00已被預約
  }
  
  return occupied[dateString] || []
}
*/

// 串api
const getOccupiedSlots = async (dateString) => {
  try {
    const res = await fetch(`/api/technicians/${artistName.value}/slots?date=${dateString}`);
    const data = await res.json();
    const available = data.availableSlots;

    // 找出美甲師當日所有時段（from weeklySchedule）
    const dateObj = new Date(dateString);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    const allSlots = props.weeklySchedule[dayName]?.timeSlots || [];

    // 哪些 slots 沒有出現在 availableSlots 就是已被預約
    return allSlots.filter(slot => !available.includes(slot));
  } catch (err) {
    console.error('載入可預約時段失敗:', err);
    return [];
  }
};


// 選擇日期
const selectDate = (dateString) => {
  selectedDate.value = dateString
  selectedTime.value = '' // 重置時間選擇
  updateTimeSlotAvailability(dateString)
}

// 選擇時間
const selectTime = (time) => {
  selectedTime.value = time
}

// 格式化日期顯示
const formatDisplayDate = (dateString) => {
  if (!dateString) return ''
  
  const [year, month, day] = dateString.split('-')
  return `${year}/${month}/${day}`
}

onMounted(() => {
  // 根據傳入的 Id 設置美甲師名稱
  if (props.artistId === '1') {
    artistName.value = 'waka.nail'
  } else if (props.artistId === '2') {
    artistName.value = 'jolieee_nail'
  } else if (props.artistId === '3') {
    artistName.value = '61.nail'
  } else if (props.artistId === '4') {
    artistName.value = 'test.nail'
  } else {
    artistName.value = '未知美甲師'
  }
  
  // 設置當前日期為今天
  currentDate.value = new Date()
})

/*
const submitBooking = () => {
  if (selectedDate.value && selectedTime.value) {
    // 顯示預約成功提示
    showSuccess.value = true
  }
}
*/

const submitBooking = async () => {
  if (!selectedDate.value || !selectedTime.value) return;

  try {
    const res = await fetch('/api/reservations/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'demo_user',                // ❗之後請換成登入者的 username
        studio: artistName.value,             // e.g., 'waka.nail'
        date: selectedDate.value,             // e.g., '2025-06-01'
        time: selectedTime.value,             // e.g., '10:00-12:00'
        note: notes.value || ''
      })
    });

    if (!res.ok) {
      let errText = '預約失敗';
      try {
        const errData = await res.json();
        errText = errData.error || errText;
      } catch (_) {
    // 如果不是 JSON 格式，直接使用預設錯誤訊息
    }
      throw new Error(errText);
    }

    showSuccess.value = true;
  } catch (err) {
    console.error('預約送出失敗:', err.message);
    alert(`預約失敗：${err.message}`);
  }
};


const finishBooking = () => {
  // 關閉成功提示並通知關閉彈窗/側邊欄
  showSuccess.value = false
  emit('close')
}
</script>

<style scoped>
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.date-selector {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

/* 日期選擇樣式 */
.date-selector .grid > div {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 時間選擇樣式 */
.time-selector button {
  transition: all 0.2s ease;
}
</style>