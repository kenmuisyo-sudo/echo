import { useAsync } from './useAsync'
import { customerService } from '../services/customerService'
import { inventoryService } from '../services/inventoryService'
import { saleService } from '../services/salesService'
import { creditService } from '../services/creditService'
import { paymentService } from '../services/paymentService'

export const useDashboardData = () =>
  useAsync(async () => {
    const [customers, vehicles, sales, credit, payments] = await Promise.all([
      customerService.getAll(),
      inventoryService.getAll(),
      saleService.getAll(),
      creditService.getAll(),
      paymentService.getAll(),
    ])
    return { customers, vehicles, sales, credit, payments }
  }, [])
