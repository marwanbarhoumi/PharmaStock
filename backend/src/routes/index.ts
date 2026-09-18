import { Router } from 'express'

import { alertRouter } from './alert.routes.js'
import { auditLogRouter } from './audit-log.routes.js'
import { authRouter } from './auth.routes.js'
import { batchRouter } from './batch.routes.js'
import { categoryRouter } from './category.routes.js'
import { healthRouter } from './health.routes.js'
import { medicineRouter } from './medicine.routes.js'
import { notificationRouter } from './notification.routes.js'
import { purchaseRouter } from './purchase.routes.js'
import { saleRouter } from './sale.routes.js'
import { stockRouter } from './stock.routes.js'
import { supplierRouter } from './supplier.routes.js'

const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/medicines', medicineRouter)
apiRouter.use('/categories', categoryRouter)
apiRouter.use('/suppliers', supplierRouter)
apiRouter.use('/batches', batchRouter)
apiRouter.use('/stock', stockRouter)
apiRouter.use('/sales', saleRouter)
apiRouter.use('/purchases', purchaseRouter)
apiRouter.use('/notifications', notificationRouter)
apiRouter.use('/alerts', alertRouter)
apiRouter.use('/audit-logs', auditLogRouter)

export { apiRouter }
