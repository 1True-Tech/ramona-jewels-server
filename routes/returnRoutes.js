const express = require('express')
const { protect, authorize } = require('../middlewares/auth')
const { 
  createReturnRequest,
  getMyReturns,
  getReturnById,
  updateReturnStatus,
} = require('../controllers/returnController')

const router = express.Router()

router.post('/', protect, createReturnRequest)
router.get('/my', protect, getMyReturns)
router.get('/:id', protect, getReturnById)
router.patch('/:id/status', protect, authorize('admin'), updateReturnStatus)

module.exports = router