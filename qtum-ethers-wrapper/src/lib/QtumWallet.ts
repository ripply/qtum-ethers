import { BigNumber as BigNumberEthers, Wallet } from "ethers";
import {
    resolveProperties,
    Logger,
} from "ethers/lib/utils";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { BigNumber } from "bignumber.js"
import { sha256, ripemd160 } from "hash.js"
import { Tx, txToBuffer, p2pkhScriptSig, signp2pkh, addVins, addp2pkhVouts, addContractVouts } from './utils'

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

    signTransaction = (transaction: TransactionRequest): Promise<string> => {
        return this.populateTransaction(transaction).then((transactionRequest) => {
            return resolveProperties(transactionRequest).then((tx) => {
                // Transform Hex Values
                let gasPrice: number | string;
                let gasLimit: number;
                let neededAmount: string;
                typeof tx.gasPrice !== "undefined" && tx.gasPrice !== "" ? gasPrice = new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7) : gasPrice = 0.0000004;
                typeof tx.gasLimit !== "undefined" && tx.gasLimit !== "" ? gasLimit = BigNumberEthers.from(tx.gasLimit).toNumber() : gasLimit = 2500000;
                typeof tx.value !== "undefined" && tx.value !== "" ? neededAmount = new BigNumber(gasPrice).times(gasLimit).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7) : neededAmount = new BigNumber(gasPrice).times(gasLimit).toFixed(7);
                // Create the transaction object
                let qtumTx: Tx = { version: 2, locktime: 0, vins: [], vouts: [] };
                const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex")
                const hash160PubKey = ripemd160().update(sha256Hash, "hex").digest("hex")
                // Check that the account has enough UTXO's for spending + gas 
                // @ts-ignore
                const serializedTransaction = this.provider.getUtxos(tx.from, neededAmount).then((result) => {
                    // Select the Vins
                    let [vins, amounts] = addVins(result, neededAmount, hash160PubKey);
                    qtumTx.vins = vins;
                    // Check if this is a deploy, call, or sendtoaddress TX
                    if ((tx.to == "" || tx.to == undefined) && tx.data != "") {
                        // Deploy 
                        // Add the Vouts
                        // @ts-ignore
                        qtumTx.vouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), gasLimit, tx.data, "", amounts, neededAmount, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) }
                        })
                        qtumTx.vins = updatedVins
                        let result1 = txToBuffer(qtumTx).toString('hex');
                        console.log(result1, "result");
                        return result1;
                    }
                    else if ((tx.to == "" || tx.to == undefined) && tx.data != "" && tx.value !== "") {
                        return logger.throwError(
                            "You cannot send QTUM while deploying a contract.",
                            Logger.errors.NOT_IMPLEMENTED,
                            {
                                error: "You cannot send QTUM while deploying a contract.",
                            }
                        );
                    }
                    else if (tx.to != "" && tx.data != "") {
                        // Call
                        // Add the Vouts
                        // @ts-ignore
                        qtumTx.vouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), gasLimit, tx.data, tx.to, amounts, neededAmount, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) }
                        })
                        qtumTx.vins = updatedVins
                        let result1 = txToBuffer(qtumTx).toString('hex');
                        console.log(result1, "result");
                        return result1;
                    }
                    else {
                        // Send to address
                        const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex")
                        const hash160PubKey = ripemd160().update(sha256Hash, "hex").digest("hex")
                        // @ts-ignore
                        const sha256HashAddress = sha256().update(tx.to.split("0x")[1], "hex").digest("hex")
                        const hash160Address = ripemd160().update(sha256HashAddress, "hex").digest("hex")
                        qtumTx.vouts = addp2pkhVouts(hash160Address, amounts, neededAmount, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) }
                        })
                        qtumTx.vins = updatedVins
                        let result1 = txToBuffer(qtumTx).toString('hex');
                        console.log(result1, "result");
                        return result1;
                    }
                }).catch((error: any) => {
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
                })
                return serializedTransaction;
            });
        })
    };

}