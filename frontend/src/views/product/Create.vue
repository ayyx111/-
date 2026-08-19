<script setup>
// 发布/编辑商品页:图片上传 + 表单校验
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import productApi from '@/api/product'
import { useProductStore } from '@/stores/product'
import { resolveImageUrl, CONDITION_MAP, TRADE_TYPE_MAP } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const productStore = useProductStore()

const formRef = ref()
const loading = ref(false)
const isEdit = computed(() => !!route.params.id)

const form = reactive({
  title: '',
  description: '',
  categoryId: '',
  price: '',
  originalPrice: '',
  conditionLevel: 2,
  tradeType: 3,
  location: '',
  images: [] // 已上传的图片 url 数组
})

const rules = {
  title: [
    { required: true, message: '请输入商品标题', trigger: 'blur' },
    { max: 30, message: '标题不超过30字', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入商品描述', trigger: 'blur' },
    { max: 500, message: '描述不超过500字', trigger: 'blur' }
  ],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  price: [
    { required: true, message: '请输入售价', trigger: 'blur' },
    {
      validator: (rule, value, cb) => {
        if (value !== '' && Number(value) <= 0) cb(new Error('售价必须大于0'))
        else cb()
      },
      trigger: 'blur'
    }
  ],
  conditionLevel: [{ required: true, message: '请选择新旧程度', trigger: 'change' }]
}

// 新旧程度选项
const conditionOptions = Object.entries(CONDITION_MAP).map(([k, v]) => ({
  value: Number(k),
  label: v.label
}))

// 图片上传
const uploadRef = ref()
const fileList = ref([]) // el-upload 文件列表(受控),每一项带 url/status/name

// 自定义上传:经 axios 封装携带 VITE_API_BASE_URL + token + 统一响应解包
// - 后端 multer 监听字段名 `file`(imageUpload = upload.single('file'))
async function customUpload({ file, onSuccess, onError }) {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const data = await productApi.uploadImage(formData)
    // data = { url, filename, size, mimetype } (拦截器已 return res.data)
    const url = data?.url
    if (!url) throw new Error('上传响应缺少 url')
    // 写入正式集合
    form.images.push(url)
    // 同步到 fileList,让 UI 显示缩略图/移除按钮
    fileList.value = fileList.value.map((item) =>
      item.uid === file.uid
        ? { ...item, url: resolveImageUrl(url), status: 'success' }
        : item
    )
    onSuccess?.(data)
  } catch (e) {
    // 失败的条目剔除
    fileList.value = fileList.value.filter((item) => item.uid !== file?.uid)
    onError?.(e)
    // HTTP 错误已经由 axios 拦截器弹过 ElMessage,避免重复弹窗
    const isHttpError = !!e?.response || (e?.message && /status code \d+/.test(e.message) || e?.message === '请求的资源不存在' || e?.message?.startsWith('请求') || e?.message?.startsWith('服务器') || e?.message?.startsWith('无权限') || e?.message?.startsWith('登录') || e?.message?.startsWith('网络'))
    if (!isHttpError) {
      ElMessage.error(e?.message || '图片上传失败')
    }
  }
}

// 上传前校验
function beforeUpload(file) {
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isImage) {
    ElMessage.error('仅支持 jpg/png/webp 格式')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB')
    return false
  }
  return true
}

// 选文件后先把临时条目推入 fileList(等 customUpload 成功再补 url)
function handleFileChange(file, list) {
  fileList.value = list
}

// 超出数量限制
function handleExceed() {
  ElMessage.warning('最多上传9张图片')
}

// 移除图片
function handleRemove(file) {
  const url = file.response?.data?.url || file.url
  if (url) {
    form.images = form.images.filter((u) =>
      u === url ? false : resolveImageUrl(u) !== resolveImageUrl(url)
    )
  }
  fileList.value = fileList.value.filter((item) => item.uid !== file.uid)
}

// 加载编辑数据
async function loadProduct() {
  if (!isEdit.value) return
  try {
    const res = await productApi.getDetail(route.params.id)
    form.title = res.title
    form.description = res.description
    form.categoryId = res.category?.id
    form.price = res.price
    form.originalPrice = res.originalPrice || ''
    form.conditionLevel = res.conditionLevel
    form.tradeType = res.tradeType
    form.location = res.location || ''
    form.images = res.images || []
    fileList.value = form.images.map((url) => ({ name: url, url: resolveImageUrl(url) }))
  } catch (e) {
    ElMessage.error('加载商品信息失败')
    router.push('/profile/products')
  }
}

// AI 审核结果提示
const aiReview = ref(null)

// AI 审核结果文案映射
const AI_REVIEW_MAP = {
  pass: { type: 'success', label: 'AI 审核通过', statusText: '已上架' },
  suspicious: { type: 'warning', label: 'AI 审核可疑', statusText: '待人工复审' },
  reject: { type: 'error', label: 'AI 审核拒绝', statusText: '已拒绝' }
}

// 把商品返回的 ai_review_result(0/1/2) 转为文案 key
function aiResultKey(val) {
  return { 0: 'pass', 1: 'suspicious', 2: 'reject' }[val] || 'pass'
}

// 提交
async function handleSubmit() {
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    if (form.images.length === 0) {
      ElMessage.warning('请至少上传1张图片')
      return
    }
    loading.value = true
    aiReview.value = null
    try {
      const formData = new FormData()
      formData.append('title', form.title)
      formData.append('description', form.description)
      formData.append('categoryId', form.categoryId)
      formData.append('price', form.price)
      if (form.originalPrice) formData.append('originalPrice', form.originalPrice)
      formData.append('conditionLevel', form.conditionLevel)
      formData.append('tradeType', form.tradeType)
      if (form.location) formData.append('location', form.location)
      form.images.forEach((url) => formData.append('images', url))

      let res
      if (isEdit.value) {
        res = await productApi.update(route.params.id, formData)
      } else {
        res = await productApi.create(formData)
      }

      // 解析 AI 审核结果并展示
      const product = res?.data || res
      const aiKey = aiResultKey(product.aiReviewResult ?? product.ai_review_result)
      const meta = AI_REVIEW_MAP[aiKey]
      aiReview.value = {
        key: aiKey,
        label: meta.label,
        statusText: meta.statusText,
        reason: product.aiReviewReason || product.ai_review_reason || '',
        type: meta.type
      }
      ElMessage({
        type: meta.type,
        message: `${isEdit.value ? '修改' : '发布'}成功 - ${meta.label},${meta.statusText}`,
        duration: 4000
      })

      // AI 通过或拒绝时延迟跳转,可疑(待人工复审)也跳转,但保留提示
      setTimeout(() => router.push('/profile/products'), 2000)
    } catch (e) {
      // ignore
    } finally {
      loading.value = false
    }
  })
}

function handleCancel() {
  router.back()
}

onMounted(async () => {
  await productStore.fetchCategories()
  loadProduct()
})
</script>

<template>
  <div class="page-wrapper">
    <div class="container">
      <div class="create-card card">
        <h2 class="page-title">{{ isEdit ? '编辑商品' : '发布商品' }}</h2>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="100px"
          size="large"
        >
          <!-- 图片上传 -->
          <el-form-item label="商品图片" required>
            <el-upload
              ref="uploadRef"
              v-model:file-list="fileList"
              :http-request="customUpload"
              list-type="picture-card"
              :limit="9"
              :before-upload="beforeUpload"
              :on-change="handleFileChange"
              :on-exceed="handleExceed"
              :on-remove="handleRemove"
              accept="image/jpeg,image/png,image/webp"
              multiple
              :auto-upload="true"
            >
              <el-icon><Plus /></el-icon>
              <template #tip>
                <div class="upload-tip">最多上传9张,支持 jpg/png/webp,单张不超过5MB</div>
              </template>
            </el-upload>
          </el-form-item>

          <el-form-item label="商品标题" prop="title">
            <el-input v-model="form.title" placeholder="请输入商品标题(30字以内)" maxlength="30" show-word-limit />
          </el-form-item>

          <el-form-item label="商品描述" prop="description">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="4"
              placeholder="详细描述商品成色、使用情况等(500字以内)"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="商品分类" prop="categoryId">
            <el-select v-model="form.categoryId" placeholder="请选择分类" style="width: 100%">
              <el-option
                v-for="c in productStore.categories"
                :key="c.id"
                :label="c.name"
                :value="c.id"
              />
            </el-select>
          </el-form-item>

          <div class="form-row">
            <el-form-item label="售价" prop="price">
              <el-input v-model="form.price" placeholder="¥ 0.00" type="number">
                <template #prepend>¥</template>
              </el-input>
            </el-form-item>
            <el-form-item label="原价">
              <el-input v-model="form.originalPrice" placeholder="选填" type="number">
                <template #prepend>¥</template>
              </el-input>
            </el-form-item>
          </div>

          <el-form-item label="新旧程度" prop="conditionLevel">
            <el-radio-group v-model="form.conditionLevel">
              <el-radio v-for="c in conditionOptions" :key="c.value" :value="c.value">
                {{ c.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="交易方式" prop="tradeType">
            <el-radio-group v-model="form.tradeType">
              <el-radio :value="1">当面交易</el-radio>
              <el-radio :value="2">邮寄</el-radio>
              <el-radio :value="3">面交/邮寄</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="交易地点">
            <el-input v-model="form.location" placeholder="如:某某大学南门(选填)" maxlength="50" />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="loading" @click="handleSubmit">
              {{ isEdit ? '保存修改' : '发布商品' }}
            </el-button>
            <el-button @click="handleCancel">取消</el-button>
          </el-form-item>
        </el-form>

        <!-- AI 审核结果提示 -->
        <el-alert
          v-if="aiReview"
          :type="aiReview.type"
          :title="aiReview.label + ' · ' + aiReview.statusText"
          :description="aiReview.reason"
          show-icon
          :closable="false"
          class="ai-review-alert"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.create-card {
  max-width: 760px;
  margin: 0 auto;
  padding: 30px;
}
.page-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 30px;
  text-align: center;
}
.upload-tip {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
.ai-review-alert {
  margin-top: 16px;
}
.form-row {
  display: flex;
  gap: 20px;
  .el-form-item {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .create-card {
    padding: 20px 16px;
  }
  .form-row {
    flex-direction: column;
    gap: 0;
  }
  :deep(.el-form-item__label) {
    width: 80px !important;
  }
}
</style>
