import {
    resolveProperties,
    Logger,
} from "ethers/lib/utils";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { BigNumber } from "bignumber.js"
import { checkTransactionType, serializeTransaction, SerializedTransaction } from './helpers/utils'
import { GLOBAL_VARS } from './helpers/global-vars'
import { IntermediateWallet } from './helpers/IntermediateWallet'

const logger = new Logger("QtumWallet");
const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS
];


export class QtumWallet extends IntermediateWallet {

    constructor(privateKey: any, provider?: any) {
        super(privateKey, provider);
    }

    protected async serializeTransaction(utxos: Array<any>, neededAmount: string, tx: TransactionRequest, transactionType: number): Promise<SerializedTransaction> {
        return await serializeTransaction(utxos, neededAmount, tx, transactionType, this.privateKey, this.publicKey);
    }

    /**
     * Override to build a raw QTUM transaction signing UTXO's
     */
    async signTransaction(transaction: TransactionRequest): Promise<string> {
        const tx = await resolveProperties(transaction);

        if (!transaction.gasPrice) {
            transaction.gasPrice = "0x28";
        }

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
            console.log("getUTXOS", neededAmount)
            // @ts-ignore
            utxos = await this.provider.getUtxos(tx.from, neededAmount);
            // Grab vins for transaction object.
        } catch (error: any) {
            console.error("error getting utxos", error);
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

        const { serializedTransaction, networkFee } = await this.serializeTransaction(utxos, neededAmount, tx, transactionType);

        if (networkFee !== "") {
            try {
                // Try again with the network fee included
                const updatedNeededAmount = new BigNumber(neededAmount).plus(networkFee);
                console.log("getUTXOS 2", neededAmount)
                // @ts-ignore
                utxos = await this.provider.getUtxos(tx.from, updatedNeededAmount);
                // Grab vins for transaction object.
            } catch (error: any) {
                console.error("error getting utxos", error);
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
            const serialized = await this.serializeTransaction(utxos, neededAmount, tx, transactionType);
            console.log("signTransaction 2", serialized)
            console.log("neededAmount", neededAmount)
            console.log("networkFee", networkFee)
            console.log("utxos", utxos)
            if (serialized.serializedTransaction === "") {
                throw new Error("Failed to generate vouts");
            }
            return serialized.serializedTransaction;
        }

        console.log("signTransaction 1", serializedTransaction)
        return serializedTransaction;
    }
}