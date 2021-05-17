import { BigNumber as BigNumberEthers, Wallet } from "ethers";
import {
    resolveProperties,
    Logger,
} from "ethers/lib/utils";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { BigNumber } from "bignumber.js"
import { sha256, ripemd160 } from "hash.js"
import { Tx, txToBuffer, p2pkhScriptSig, signp2pkh, addVins, addp2pkhVouts, addContractVouts, generateContractAddress } from './utils'

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
        return resolveProperties(transaction).then((tx) => {
            // Transform Hex Values
            let gasPrice: string;
            let gasLimit: number;
            let neededAmount: string;
            // @ts-ignore
            tx.gasPrice !== "" ? gasPrice = new BigNumber(parseInt(tx.gasPrice.toString(), 16).toString() + `e-8`).toFixed(7) : gasPrice = new BigNumber(parseInt("0x28".toString(), 16).toString() + `e-8`).toFixed(7);
            tx.gasLimit !== "" ? gasLimit = BigNumberEthers.from(tx.gasLimit).toNumber() : gasLimit = 250000;
            tx.value !== "" ? neededAmount = new BigNumber(gasPrice).times(gasLimit).plus(parseInt("0xffffff".toString(), 16).toString() + `e-8`).toFixed(7) : neededAmount = new BigNumber(gasPrice).times(gasLimit).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7);
            // Create the transaction object
            let qtumTx: Tx = { version: 2, locktime: 0, vins: [], vouts: [] };
            const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex")
            const hash160PubKey = ripemd160().update(sha256Hash, "hex").digest("hex")
            // Check that the account has enough UTXO's for spending + gas 
            // @ts-ignore
            this.provider.getUtxos(tx.from, neededAmount).then((result) => {
                // Select the Vins
                let [vins, amounts] = addVins(result, neededAmount, hash160PubKey);
                qtumTx.vins = vins;
                // Check if this is a deploy, call, or sendtoaddress TX
                if ((tx.to == "" || tx.to == undefined) && tx.data != "") {
                    // Deploy 
                    // Add the Vouts
                    // @ts-ignore
                    qtumTx.vouts = addContractVouts(40, 2500000, tx.data, "", amounts, 1.003, hash160PubKey);
                    let updatedVins = qtumTx.vins.map((vin, index) => {
                        return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) }
                    })
                    qtumTx.vins = updatedVins
                    let result = txToBuffer(qtumTx).toString('hex');
                    console.log(result, "result");
                    return;
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
                    qtumTx.vouts = addContractVouts(40, 250000, tx.data, tx.to, amounts, neededAmount, hash160PubKey);
                    let updatedVins = qtumTx.vins.map((vin, index) => {
                        return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) }
                    })
                    qtumTx.vins = updatedVins
                    let result = txToBuffer(qtumTx).toString('hex');
                    console.log(result, "result");
                    return;
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
                    let result = txToBuffer(qtumTx).toString('hex');
                    console.log(result, "result");
                    return;
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
            });

            return Promise.resolve(`020000000100d88aad446a825f03ac08cb870ff963bb0921edfed70356c61ab04205cda4a5000000008a47304402207c2ddfd9209af61ea0adfcd9e998d84ed75e00f6b1e074add58f3b32e2a254f4022060d3c7eb62a2d3e48e526c465dd90b101f15ff9a42d137b98747ebf933b68f710141040674a4bcaba69378609e31faab1475bae52775da9ffc152e3008f7db2baa69abc1e8c4dcb46083ad56b73614d3eb01f717499c19510544a214f4db4a7c2ea503ffffffff010000000000000000fdfd00010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c100000000`);
        });
    };
}