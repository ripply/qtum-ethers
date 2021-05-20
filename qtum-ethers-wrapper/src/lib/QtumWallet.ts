import {
    resolveProperties,
    Logger,
} from "ethers/lib/utils";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { BigNumber } from "bignumber.js"
import { checkTransactionType, serializeTransaction } from './helpers/utils'
import { GLOBAL_VARS } from './helpers/global-vars'
import { IntermediateWallet } from './helpers/IntermediateWallet'

const logger = new Logger("QtumWallet");
const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS
];


export class QtumWallet extends IntermediateWallet {

    /**
     * Override to build a raw QTUM transaction signing UTXO's
     */
    async signTransaction(transaction: TransactionRequest): Promise<string> {
        const tx = await resolveProperties(transaction);

        // Refactored to check TX type (call, create, p2pkh, deploy error) and calculate needed amount
        const { transactionType, neededAmount } = checkTransactionType(tx);

        // Check if the transactionType matches the DEPLOY_ERROR, throw error else continue
        if (transactionType === GLOBAL_VARS.DEPLOY_ERROR) {
            return logger.throwError(
                "You cannot send QTUM while deploying a contract. Try deploying again without a value.",
                Logger.errors.NOT_IMPLEMENTED,
                {
                    error: "You cannot send QTUM while deploying a contract. Try deploying again without a value.",
                }
            );
        }

        let utxos = [];
        try {
            // @ts-ignore
            utxos = await this.provider.getUtxos(tx.from, neededAmount);
            // Grab vins for transaction object.
        } catch (error: any) {
            if (forwardErrors.indexOf(error.code) >= 0) {
                throw error;
            }
            return logger.throwError(
                "Needed amount of UTXO's exceed the total you own.",
                Logger.errors.INSUFFICIENT_FUNDS,
                {
                    error: error,
                }
            );
        }

        const { serializedTransaction, networkFee } = serializeTransaction(utxos, neededAmount, tx, transactionType, this.privateKey, this.publicKey);

        if (networkFee !== "") {
            try {
                // Try again with the network fee included
                const updatedNeededAmount = new BigNumber(neededAmount).plus(networkFee);
                // @ts-ignore
                utxos = await this.provider.getUtxos(tx.from, updatedNeededAmount);
                // Grab vins for transaction object.
            } catch (error: any) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError(
                    "Needed amount of UTXO's exceed the total you own.",
                    Logger.errors.INSUFFICIENT_FUNDS,
                    {
                        error: error,
                    }
                );
            }
            const serialized = serializeTransaction(utxos, neededAmount, tx, transactionType, this.publicKey, this.privateKey);
            return serialized.serializedTransaction;
        }

        return serializedTransaction;
    }
}