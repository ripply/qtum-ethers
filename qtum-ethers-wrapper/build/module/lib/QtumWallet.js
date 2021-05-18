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
    }
    // Override to create a raw, serialized, and signed transaction based on QTUM's UTXO model
    async signTransaction(transaction) {
        const populatedTransaction = await this.populateTransaction(transaction);
        const tx = await resolveProperties(populatedTransaction);
        // Building the QTUM tx that will eventually be serialized.
        let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
        // Get the public key, sha256 hash the pubkey, then run ripemd160 on the sha256 hash, return the hash160PubKey
        const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
        const hash160PubKey = ripemd160().update(sha256Hash, "hex").digest("hex");
        // 100,000 bytes = 0.004 * 100 = 0.4 https://medium.com/coinmonks/big-transactions-big-blocks-42d04b3b635b, assuming MAX_FEE_RATE is needed when grabbing UTXO's.
        const MAX_FEE_RATE = 0.4;
        // Determine if this transaction is a contract creation, call, or send-to-address
        if (!!tx.to === false && !!tx.value === false && !!tx.data === true) {
            // Contract Creation
            // @ts-ignore
            const needed = new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(MAX_FEE_RATE).toFixed(7);
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed);
                // Grab vins for transaction object.
                const [vins, amounts] = addVins(utxos, needed, hash160PubKey);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), BigNumberEthers.from(tx.gasLimit).toNumber(), tx.data, "", amounts, needed, 0, hash160PubKey);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) };
                });
                qtumTx.vins = updatedVins;
                // Build the serialized transaction string.
                const serialized = txToBuffer(qtumTx).toString('hex');
                console.log(serialized, "serializedString");
                return serialized;
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", Logger.errors.INSUFFICIENT_FUNDS, {
                    error: error,
                });
            }
        }
        else if (!!tx.to === false && !!tx.value === true && !!tx.data === true) {
            return logger.throwError("You cannot send QTUM while deploying a contract. Try deploying again without a value.", Logger.errors.NOT_IMPLEMENTED, {
                error: "You cannot send QTUM while deploying a contract. Try deploying again without a value.",
            });
        }
        else if (!!tx.to === true && !!tx.data === true) {
            // Call Contract
            // @ts-ignore
            const needed = !!tx.value === true ? new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(MAX_FEE_RATE).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7) : new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(MAX_FEE_RATE).toFixed(7);
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed);
                // Grab vins for transaction object.
                const [vins, amounts] = addVins(utxos, needed, hash160PubKey);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), BigNumberEthers.from(tx.gasLimit).toNumber(), tx.data, tx.to, amounts, needed, !!tx.value === true ? new BigNumber(BigNumberEthers.from(tx.value).toNumber() + `e-8`).times(1e8).toNumber() : 0, hash160PubKey);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) };
                });
                qtumTx.vins = updatedVins;
                // Build the serialized transaction string.
                const serialized = txToBuffer(qtumTx).toString('hex');
                console.log(serialized, "serializedString");
                return serialized;
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", Logger.errors.INSUFFICIENT_FUNDS, {
                    error: error,
                });
            }
        }
        else if (!!tx.to === true && !!tx.value === true && !!tx.data === false) {
            // P2PKH (send-to-address)
            // @ts-ignore
            const needed = new BigNumber(MAX_FEE_RATE).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7);
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed);
                // Grab vins for transaction object.
                const [vins, amounts] = addVins(utxos, needed, hash160PubKey);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = addp2pkhVouts(tx.to.split("0x")[1], amounts, new BigNumber(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7), hash160PubKey);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) };
                });
                qtumTx.vins = updatedVins;
                // Build the serialized transaction string.
                const serialized = txToBuffer(qtumTx).toString('hex');
                console.log(serialized, "serializedString");
                return serialized;
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", Logger.errors.INSUFFICIENT_FUNDS, {
                    error: error,
                });
            }
        }
        else {
            return logger.throwError("Unidentified error building your transaction, make sure the to, from, gasPrice, gasLimit, and data fields are correct.", Logger.errors.NOT_IMPLEMENTED, {
                error: "Unidentified error building your transaction, make sure the to, from, gasPrice, gasLimit, and data fields are correct.",
            });
        }
    }
    ;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxJQUFJLGVBQWUsRUFBRSxNQUFNLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDOUQsT0FBTyxFQUNILGlCQUFpQixFQUNqQixNQUFNLEdBQ1QsTUFBTSxrQkFBa0IsQ0FBQztBQUUxQixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sY0FBYyxDQUFBO0FBQ3hDLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sU0FBUyxDQUFBO0FBQzNDLE9BQU8sRUFBTSxVQUFVLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sU0FBUyxDQUFBO0FBRTdHLE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRXhDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLE1BQU0sQ0FBQyxNQUFNLENBQUMsa0JBQWtCO0NBQ25DLENBQUM7QUFHRixNQUFNLE9BQU8sVUFBVyxTQUFRLE1BQU07SUFBdEM7UUFFSSw2SEFBNkg7O1FBRTdILGVBQVUsR0FBRyxHQUFvQixFQUFFO1lBQy9CLE1BQU0sVUFBVSxHQUFHLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7WUFDdkYsTUFBTSxpQkFBaUIsR0FBRyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUM3RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxpQkFBaUIs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