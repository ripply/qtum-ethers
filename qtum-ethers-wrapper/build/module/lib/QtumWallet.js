import { BigNumber as BigNumberEthers } from "ethers";
import { resolveProperties, Logger, } from "ethers/lib/utils";
import { BigNumber } from "bignumber.js";
import { sha256, ripemd160 } from "hash.js";
import { txToBuffer, p2pkhScriptSig, signp2pkh, addVins, addp2pkhVouts, addContractVouts } from './helpers/utils';
import { GLOBAL_VARS } from './helpers/global-vars';
import { IntermediateWallet } from './helpers/IntermediateWallet';
const logger = new Logger("QtumWallet");
const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS
];
export class QtumWallet extends IntermediateWallet {
    constructor() {
        // Get the public key, sha256 hash the pubkey, then run ripemd160 on the sha256 hash, append 0x prefix and return the address
        super(...arguments);
        this.getAddress = () => {
            const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
            const prefixlessAddress = ripemd160().update(sha256Hash, "hex").digest("hex");
            return Promise.resolve(`0x${prefixlessAddress}`);
        };
    }
    get address() {
        const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
        const prefixlessAddress = ripemd160().update(sha256Hash, "hex").digest("hex");
        return `0x${prefixlessAddress}`;
    }
    // Override to create a raw, serialized, and signed transaction based on QTUM's UTXO model
    async signTransaction(transaction) {
        const populatedTransaction = await this.populateTransaction(transaction);
        const tx = await resolveProperties(populatedTransaction);
        // Building the QTUM tx that will eventually be serialized.
        let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
        // Determine if this transaction is a contract creation, call, or send-to-address
        if (!!tx.to === false && !!tx.value === false && !!tx.data === true) {
            // Contract Creation
            // @ts-ignore
            const needed = new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(GLOBAL_VARS.MAX_FEE_RATE).toFixed(7);
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed);
                // Grab vins for transaction object.
                // @ts-ignore
                const [vins, amounts] = addVins(utxos, needed, tx.from.split("0x")[1]);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), BigNumberEthers.from(tx.gasLimit).toNumber(), tx.data, "", amounts, needed, 0, tx.from.split("0x")[1]);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) };
                });
                qtumTx.vins = updatedVins;
                // Build the serialized transaction string.
                const serialized = txToBuffer(qtumTx).toString('hex');
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
            const needed = !!tx.value === true ? new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(GLOBAL_VARS.MAX_FEE_RATE).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7) : new BigNumber(new BigNumber(BigNumberEthers.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(BigNumberEthers.from(tx.gasLimit).toNumber()).plus(GLOBAL_VARS.MAX_FEE_RATE).toFixed(7);
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed);
                // Grab vins for transaction object.
                // @ts-ignore
                const [vins, amounts] = addVins(utxos, needed, tx.from.split("0x")[1]);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = addContractVouts(BigNumberEthers.from(tx.gasPrice).toNumber(), BigNumberEthers.from(tx.gasLimit).toNumber(), tx.data, tx.to, amounts, needed, !!tx.value === true ? new BigNumber(BigNumberEthers.from(tx.value).toNumber() + `e-8`).times(1e8).toNumber() : 0, tx.from.split("0x")[1]);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) };
                });
                qtumTx.vins = updatedVins;
                // Build the serialized transaction string.
                const serialized = txToBuffer(qtumTx).toString('hex');
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
            const needed = new BigNumber(GLOBAL_VARS.MAX_FEE_RATE).plus(BigNumberEthers.from(tx.value).toNumber() + `e-8`).toFixed(7);
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed);
                // Grab vins for transaction object.
                // @ts-ignore
                const [vins, amounts] = addVins(utxos, needed, tx.from.split("0x")[1]);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = addp2pkhVouts(tx.to.split("0x")[1], amounts, new BigNumber(BigNumberEthers.from(tx.value).toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1]);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return { ...vin, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) };
                });
                qtumTx.vins = updatedVins;
                // Build the serialized transaction string.
                const serialized = txToBuffer(qtumTx).toString('hex');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxJQUFJLGVBQWUsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUN0RCxPQUFPLEVBQ0gsaUJBQWlCLEVBQ2pCLE1BQU0sR0FDVCxNQUFNLGtCQUFrQixDQUFDO0FBRTFCLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxjQUFjLENBQUE7QUFDeEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxTQUFTLENBQUE7QUFDM0MsT0FBTyxFQUFNLFVBQVUsRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQTtBQUNySCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sdUJBQXVCLENBQUE7QUFDbkQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sOEJBQThCLENBQUE7QUFHakUsTUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFeEMsTUFBTSxhQUFhLEdBQUc7SUFDbEIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0I7Q0FDbkMsQ0FBQztBQUdGLE1BQU0sT0FBTyxVQUFXLFNBQVEsa0JBQWtCO0lBQWxEO1FBRUksNkhBQTZIOztRQU83SCxlQUFVLEdBQUcsR0FBb0IsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO1lBQ3ZGLE1BQU0saUJBQWlCLEdBQUcsU0FBUyxFQUFFLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxL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