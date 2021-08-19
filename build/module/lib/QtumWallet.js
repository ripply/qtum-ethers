import { resolveProperties, Logger, } from "ethers/lib/utils";
import { BigNumber } from "bignumber.js";
import { checkTransactionType, serializeTransaction } from './helpers/utils';
import { GLOBAL_VARS } from './helpers/global-vars';
import { IntermediateWallet } from './helpers/IntermediateWallet';
const logger = new Logger("QtumWallet");
const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS
];
export class QtumWallet extends IntermediateWallet {
    constructor(privateKey, provider) {
        super(privateKey, provider);
    }
    async serializeTransaction(utxos, neededAmount, tx, transactionType) {
        return await serializeTransaction(utxos, neededAmount, tx, transactionType, this.privateKey, this.publicKey);
    }
    /**
     * Override to build a raw QTUM transaction signing UTXO's
     */
    async signTransaction(transaction) {
        const tx = await resolveProperties(transaction);
        if (!transaction.gasPrice) {
            transaction.gasPrice = "0x28";
        }
        // Refactored to check TX type (call, create, p2pkh, deploy error) and calculate needed amount
        const { transactionType, neededAmount } = checkTransactionType(tx);
        // Check if the transactionType matches the DEPLOY_ERROR, throw error else continue
        if (transactionType === GLOBAL_VARS.DEPLOY_ERROR) {
            return logger.throwError("You cannot send QTUM while deploying a contract. Try deploying again without a value.", Logger.errors.NOT_IMPLEMENTED, {
                error: "You cannot send QTUM while deploying a contract. Try deploying again without a value.",
            });
        }
        let utxos = [];
        try {
            // @ts-ignore
            utxos = await this.provider.getUtxos(tx.from, neededAmount);
            // Grab vins for transaction object.
        }
        catch (error) {
            if (forwardErrors.indexOf(error.code) >= 0) {
                throw error;
            }
            return logger.throwError("Needed amount of UTXO's exceed the total you own.", Logger.errors.INSUFFICIENT_FUNDS, {
                error: error,
            });
        }
        const { serializedTransaction, networkFee } = await this.serializeTransaction(utxos, neededAmount, tx, transactionType);
        if (networkFee !== "") {
            try {
                // Try again with the network fee included
                const updatedNeededAmount = new BigNumber(neededAmount).plus(networkFee);
                // @ts-ignore
                utxos = await this.provider.getUtxos(tx.from, updatedNeededAmount);
                // Grab vins for transaction object.
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", Logger.errors.INSUFFICIENT_FUNDS, {
                    error: error,
                });
            }
            const serialized = await this.serializeTransaction(utxos, neededAmount, tx, transactionType);
            if (serialized.serializedTransaction === "") {
                throw new Error("Failed to generate vouts");
            }
            return serialized.serializedTransaction;
        }
        return serializedTransaction;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0gsaUJBQWlCLEVBQ2pCLE1BQU0sR0FDVCxNQUFNLGtCQUFrQixDQUFDO0FBRTFCLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxjQUFjLENBQUE7QUFDeEMsT0FBTyxFQUFFLG9CQUFvQixFQUFFLG9CQUFvQixFQUF5QixNQUFNLGlCQUFpQixDQUFBO0FBQ25HLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQTtBQUNuRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQTtBQUVqRSxNQUFNLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN4QyxNQUFNLGFBQWEsR0FBRztJQUNsQixNQUFNLENBQUMsTUFBTSxDQUFDLGtCQUFrQjtDQUNuQyxDQUFDO0FBR0YsTUFBTSxPQUFPLFVBQVcsU0FBUSxrQkFBa0I7SUFFOUMsWUFBWSxVQUFlLEVBQUUsUUFBYztRQUN2QyxLQUFLLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFUyxLQUFLLENBQUMsb0JBQW9CLENBQUMsS0FBaUIsRUFBRSxZQUFvQixFQUFFLEVBQXNCLEVBQUUsZUFBdUI7UUFDekgsT0FBTyxNQUFNLG9CQUFvQixDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNqSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsZUFBZSxDQUFDLFdBQStCO1FBQ2pELE1BQU0sRUFBRSxHQUFHLE1BQU0saUJBQWlCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFaEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxR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