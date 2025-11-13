import express from 'express'
import { listNotifications, markAsRead, markAllRead } from '../controller/notificationsController.js'

const router = express.Router()

router.get('/', listNotifications)
router.put('/:id/read', markAsRead)
router.put('/mark-all-read', markAllRead)

export default router
