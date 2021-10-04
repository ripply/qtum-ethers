"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QtumWallet = void 0;
const utils_1 = require("ethers/lib/utils");
const bignumber_js_1 = require("bignumber.js");
const ethers_1 = require("ethers");
const utils_2 = require("./helpers/utils");
const global_vars_1 = require("./helpers/global-vars");
const IntermediateWallet_1 = require("./helpers/IntermediateWallet");
const logger = new utils_1.Logger("QtumWallet");
const forwardErrors = [
    utils_1.Logger.errors.INSUFFICIENT_FUNDS
];
class QtumWallet extends IntermediateWallet_1.IntermediateWallet {
    constructor(privateKey, provider) {
        super(privateKey, provider);
    }
    async serializeTransaction(utxos, neededAmount, tx, transactionType) {
        return await utils_2.serializeTransaction(utxos, neededAmount, tx, transactionType, this.privateKey, this.compressedPublicKey);
    }
    /**
     * Override to build a raw QTUM transaction signing UTXO's
     */
    async signTransaction(transaction) {
        if (!transaction.gasPrice) {
            // 40 satoshi in WEI
            // 40 => 40000000000
            transaction.gasPrice = "0x9502f9000";
        }
        // convert gasPrice into satoshi
        let a = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(transaction.gasPrice).toString() + 'e-9');
        transaction.gasPrice = a.toNumber();
        const tx = await utils_1.resolveProperties(transaction);
        // Refactored to check TX type (call, create, p2pkh, deploy error) and calculate needed amount
        const { transactionType, neededAmount } = utils_2.checkTransactionType(tx);
        // Check if the transactionType matches the DEPLOY_ERROR, throw error else continue
        if (transactionType === global_vars_1.GLOBAL_VARS.DEPLOY_ERROR) {
            return logger.throwError("You cannot send QTUM while deploying a contract. Try deploying again without a value.", utils_1.Logger.errors.NOT_IMPLEMENTED, {
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
            return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
                error: error,
            });
        }
        const { serializedTransaction, networkFee } = await this.serializeTransaction(utxos, neededAmount, tx, transactionType);
        if (networkFee !== "") {
            try {
                // Try again with the network fee included
                const updatedNeededAmount = new bignumber_js_1.BigNumber(neededAmount).plus(networkFee);
                // @ts-ignore
                utxos = await this.provider.getUtxos(tx.from, updatedNeededAmount);
                // Grab vins for transaction object.
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
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
exports.QtumWallet = QtumWallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw0Q0FHMEI7QUFFMUIsK0NBQXdDO0FBQ3hDLG1DQUFzRDtBQUN0RCwyQ0FBbUc7QUFDbkcsdURBQW1EO0FBQ25ELHFFQUFpRTtBQUVqRSxNQUFNLE1BQU0sR0FBRyxJQUFJLGNBQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN4QyxNQUFNLGFBQWEsR0FBRztJQUNsQixjQUFNLENBQUMsTUFBTSxDQUFDLGtCQUFrQjtDQUNuQyxDQUFDO0FBR0YsTUFBYSxVQUFXLFNBQVEsdUNBQWtCO0lBRTlDLFlBQVksVUFBZSxFQUFFLFFBQWM7UUFDdkMsS0FBSyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRVMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLEtBQWlCLEVBQUUsWUFBb0IsRUFBRSxFQUFzQixFQUFFLGVBQXVCO1FBQ3pILE9BQU8sTUFBTSw0QkFBb0IsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUMzSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsZUFBZSxDQUFDLFdBQStCO1FBQ2pELElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFO1lBQ3ZCLG9CQUFvQjtZQUNwQixvQkFBb0I7WUFDcEIsV0FBVyxDQUFDLFFBQVEsR0FBRyxhQUFhLENBQUM7U0FDeEM7UUFFRCxnQ0FBZ0M7UUFDaEMsSUFBSSxDQUFDLEdBQUcsSUFBSSx3QkFBUyxDQUFDLGtCQUFlLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQztRQUNyRixXQUFXLENBQUMs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