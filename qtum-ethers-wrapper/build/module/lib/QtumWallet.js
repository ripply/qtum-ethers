import { BigNumber as BigNumberEthers, Wallet } from "ethers";
import { resolveProperties, Logger, } from "ethers/lib/utils";
import { BigNumber } from "bignumber.js";
import { sha256, ripemd160 } from "hash.js";
import { txToBuffer, p2pkhScriptSig, signp2pkh, addVins, addp2pkhVouts, addContractVouts } from './utils';
const logger = new Logger("QtumWallet");
const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS
];
export class QtumWallet extends Wallet {
    constructor() {
        // Get the public key, sha256 hash the pubkey, then run ripemd160 on the sha256 hash, append 0x prefix and return the address
        super(...arguments);
        this.getAddress = () => {
            const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
            const prefixlessAddress = ripemd160().update(sha256Hash, "hex").digest("hex");
            return Promise.resolve(`0x${prefixlessAddress}`);
        };
        this.signTransaction = (transaction) => {
            return this.populateTransaction(transaction).then((transactionRequest) => {
                return resolveProperties(transactionRequest).then((tx) => {
                    // Transform Hex Values
                    let gasPrice;
                    let gasLimit;
                    let neededAmount;
                    typeof tx.gasPrice !== "undefined" && tx.gasPrice !== "" ? gasPrice = new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7) : gasPrice = 0.0000004;
                    typeof tx.gasLimit !== "undefined" && tx.gasLimit !== "" ? gasLimit = BigNumberEthers.from(tx.gasLimit).toNumber() : gasLimit = 2500000;
                    typeof tx.value !== "undefined" && tx.value !== "" ? neededAmount = new BigNumber(gasPrice).times(gasLimit).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7) : neededAmount = new BigNumber(gasPrice).times(gasLimit).toFixed(7);
                    // Create the transaction object
                    let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
                    const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
                    const hash160PubKey = ripemd160().update(sha256Hash, "hex").digest("hex");
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
                                return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) };
                            });
                            qtumTx.vins = updatedVins;
                            let result1 = txToBuffer(qtumTx).toString('hex');
                            console.log(result1, "result");
                            return result1;
                        }
                        else if ((tx.to == "" || tx.to == undefined) && tx.data != "" && tx.value !== "") {
                            return logger.throwError("You cannot send QTUM while deploying a contract.", Logger.errors.NOT_IMPLEMENTED, {
                                error: "You cannot send QTUM while deploying a contract.",
                            });
                        }
                        else if (tx.to != "" && tx.data != "") {
                            // Call
                            // Add the Vouts
                            // @ts-ignore
                            qtumTx.vouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), gasLimit, tx.data, tx.to, amounts, neededAmount, hash160PubKey);
                            let updatedVins = qtumTx.vins.map((vin, index) => {
                                return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) };
                            });
                            qtumTx.vins = updatedVins;
                            let result1 = txToBuffer(qtumTx).toString('hex');
                            console.log(result1, "result");
                            return result1;
                        }
                        else {
                            // Send to address
                            const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
                            const hash160PubKey = ripemd160().update(sha256Hash, "hex").digest("hex");
                            // @ts-ignore
                            const sha256HashAddress = sha256().update(tx.to.split("0x")[1], "hex").digest("hex");
                            const hash160Address = ripemd160().update(sha256HashAddress, "hex").digest("hex");
                            qtumTx.vouts = addp2pkhVouts(hash160Address, amounts, neededAmount, hash160PubKey);
                            let updatedVins = qtumTx.vins.map((vin, index) => {
                                return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) };
                            });
                            qtumTx.vins = updatedVins;
                            let result1 = txToBuffer(qtumTx).toString('hex');
                            console.log(result1, "result");
                            return result1;
                        }
                    }).catch((error) => {
                        if (forwardErrors.indexOf(error.code) >= 0) {
                            throw error;
                        }
                        return logger.throwError("Needed amount of UTXO's exceed the total you own.", Logger.errors.INSUFFICIENT_FUNDS, {
                            error: error,
                        });
                    });
                    console.log(serializedTransaction, 'here');
                    return serializedTransaction;
                });
            });
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxJQUFJLGVBQWUsRUFBRSxNQUFNLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDOUQsT0FBTyxFQUNILGlCQUFpQixFQUNqQixNQUFNLEdBQ1QsTUFBTSxrQkFBa0IsQ0FBQztBQUUxQixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sY0FBYyxDQUFBO0FBQ3hDLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sU0FBUyxDQUFBO0FBQzNDLE9BQU8sRUFBTSxVQUFVLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sU0FBUyxDQUFBO0FBRTdHLE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRXhDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLE1BQU0sQ0FBQyxNQUFNLENBQUMsa0JBQWtCO0NBQ25DLENBQUM7QUFHRixNQUFNLE9BQU8sVUFBVyxTQUFRLE1BQU07SUFBdEM7UUFFSSw2SEFBNkg7O1FBRTdILGVBQVUsR0FBRyxHQUFvQixFQUFFO1lBQy9CLE1BQU0sVUFBVSxHQUFHLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7WUFDdkYsTUFBTSxpQkFBaUIsR0FBRyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUM3RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxpQkFBaUIs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