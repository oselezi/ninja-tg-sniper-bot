export * from './default-transaction-executor';
export * from './transaction-executor.interface';

import { TransactionExecutor } from './transaction-executor.interface';
import { DefaultTransactionExecutor } from './default-transaction-executor';

import { JitoTransactionExecutor } from './jito-rpc-transaction-executor';

export const getTransactionExecutor = (
  executor = 'default',
  CUSTOM_FEE,
  connection,
) => {
  let txExecutor: TransactionExecutor;

  switch (executor) {
    case 'jito': {
      txExecutor = new JitoTransactionExecutor(CUSTOM_FEE, connection);
      break;
    }
    default: {
      txExecutor = new DefaultTransactionExecutor(connection);
      break;
    }
  }
  return txExecutor;
};
