import { BigNumber as BigNumberEthers, Wallet } from "ethers";
import {
    resolveProperties,
    Logger,
} from "ethers/lib/utils";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { BigNumber } from "bignumber.js"
import { sha256, ripemd160 } from "hash.js"
import { Tx, txToBuffer, p2pkhScriptSig, signp2pkh, addVins, addp2pkhVouts, addContractVouts } from './helpers/utils'
import {GLOBAL_VARS} from './helpers/global-vars'
const logger = new Logger("QtumWallet");

const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS
];


export class QtumWallet extends Wallet {

    // Get the public key, sha256 hash the pubkey, then run ripemd160 on the sha256 hash, append 0x prefix and return the address

    getAddress = (): Promise<string> => {
        const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex")
        const prefixlessAddress = ripemd160().update(sha256Hash, "hex").digest("hex")
        return Promise.resolve(`0x${prefixlessAddress}`);
    };

    // Override to create a raw, serialized, and signed transaction based on QTUM's UTXO model

    async signTransaction(transaction: TransactionRequest): Promise<string> {
        const populatedTransaction = await this.populateTransaction(transaction);
        const tx = await resolveProperties(populatedTransaction);

        // Building the QTUM tx that will eventually be serialized.
        let qtumTx: Tx = { version: 2, locktime: 0, vins: [], vouts: [] };

        // Determine if this transaction is a contract creation, call, or send-to-address
        if (!!tx.to === false && !!tx.value === false && !!tx.data === true) {
            // Contract Creation
            // @ts-ignore
            const needed = new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(GLOBAL_VARS.MAX_FEE_RATE).toFixed(7)
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed)
                // Grab vins for transaction object.
                // @ts-ignore
                const [vins, amounts] = addVins(utxos, needed, tx.from.split("0x")[1]);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), BigNumberEthers.from(tx.gasLimit).toNumber(), tx.data, "", amounts, needed, 0, tx.from.split("0x")[1]);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) }
                })
                qtumTx.vins = updatedVins
                // Build the serialized transaction string.
                const serialized = txToBuffer(qtumTx).toString('hex');
                return serialized;
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

        }
        else if (!!tx.to === false && !!tx.value === true && !!tx.data === true) {
            return logger.throwError(
                "You cannot send QTUM while deploying a contract. Try deploying again without a value.",
                Logger.errors.NOT_IMPLEMENTED,
                {
                    error: "You cannot send QTUM while deploying a contract. Try deploying again without a value.",
                }
            );
        }
        else if (!!tx.to === true && !!tx.data === true) {
            // Call Contract
            // @ts-ignore
            const needed = !!tx.value === true ? new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(GLOBAL_VARS.MAX_FEE_RATE).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7) : new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(GLOBAL_VARS.MAX_FEE_RATE).toFixed(7)
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed)
                // Grab vins for transaction object.
                // @ts-ignore
                const [vins, amounts] = addVins(utxos, needed, tx.from.split("0x")[1]);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), BigNumberEthers.from(tx.gasLimit).toNumber(), tx.data, tx.to, amounts, needed, !!tx.value === true ? new BigNumber(BigNumberEthers.from(tx.value).toNumber() + `e-8`).times(1e8).toNumber() : 0, tx.from.split("0x")[1]);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) }
                })
                qtumTx.vins = updatedVins
                // Build the serialized transaction string.
                const serialized = txToBuffer(qtumTx).toString('hex');
                return serialized;
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

        }
        else if (!!tx.to === true && !!tx.value === true && !!tx.data === false) {
            // P2PKH (send-to-address)
            // @ts-ignore
            const needed = new BigNumber(GLOBAL_VARS.MAX_FEE_RATE).plus(BigNumberEthers.from(tx.value).toNumber() + `e-8`).toFixed(7);
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed)
                // Grab vins for transaction object.
                // @ts-ignore
                const [vins, amounts] = addVins(utxos, needed, tx.from.split("0x")[1]);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = addp2pkhVouts(tx.to.split("0x")[1], amounts, new BigNumber(BigNumberEthers.from(tx.value).toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1]);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) }
                })
                qtumTx.vins = updatedVins
                // Build the serialized transaction string.
                const serialized = txToBuffer(qtumTx).toString('hex');
                return serialized;
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
        }
        else {
            return logger.throwError(
                "Unidentified error building your transaction, make sure the to, from, gasPrice, gasLimit, and data fields are correct.",
                Logger.errors.NOT_IMPLEMENTED,
                {
                    error: "Unidentified error building your transaction, make sure the to, from, gasPrice, gasLimit, and data fields are correct.",
                }
            );
        }
    };

}