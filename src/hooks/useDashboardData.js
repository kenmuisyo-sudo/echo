import { useAsync } from './useAsync'
import { customerService } from '../services/customerService'
import { inventoryService } from '../services/inventoryService'
import { saleService } from '../services/salesService'
import { creditService } from '../services/creditService'

export const useDashboardData = () =>
  useAsync(async () => {
    const [customers, vehicles, sales, credit] = await Promise.all([
      customerService.getAll(),
      inventoryService.getAll(),
      saleService.getAll(),
      creditService.getAll(),
    ])
    return { customers, vehicles, sales, credit }
  }, [])
