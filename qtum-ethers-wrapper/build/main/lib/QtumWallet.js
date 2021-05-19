"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QtumWallet = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
const bignumber_js_1 = require("bignumber.js");
const utils_2 = require("./helpers/utils");
const global_vars_1 = require("./helpers/global-vars");
const IntermediateWallet_1 = require("./helpers/IntermediateWallet");
const logger = new utils_1.Logger("QtumWallet");
const forwardErrors = [
    utils_1.Logger.errors.INSUFFICIENT_FUNDS
];
class QtumWallet extends IntermediateWallet_1.IntermediateWallet {
    // Override to create a raw, serialized, and signed transaction based on QTUM's UTXO model
    async signTransaction(transaction) {
        const populatedTransaction = await this.populateTransaction(transaction);
        const tx = await utils_1.resolveProperties(populatedTransaction);
        // Determine if this transaction is a contract creation, call, or send-to-address
        if (!!tx.to === false && !!tx.value === false && !!tx.data === true) {
            // Contract Creation
            // @ts-ignore
            // gasPrice to QTUM times gasLimit
            const needed = new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(7).toString();
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed);
                // Grab vins for transaction object.
                // Building the QTUM tx that will eventually be serialized.
                let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
                // @ts-ignore
                const [vins, amounts] = utils_2.addVins(utxos, needed, tx.from.split("0x")[1]);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = utils_2.addContractVouts(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), ethers_1.BigNumber.from(tx.gasLimit).toNumber(), tx.data, "", amounts, new bignumber_js_1.BigNumber(ethers_1.BigNumber.from("0x0").toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) });
                });
                qtumTx.vins = updatedVins;
                // Build the serialized transaction string.
                const serialized = utils_2.txToBuffer(qtumTx).toString('hex');
                return serialized;
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
                    error: error,
                });
            }
        }
        else if (!!tx.to === false && !!tx.value === true && !!tx.data === true) {
            return logger.throwError("You cannot send QTUM while deploying a contract. Try deploying again without a value.", utils_1.Logger.errors.NOT_IMPLEMENTED, {
                error: "You cannot send QTUM while deploying a contract. Try deploying again without a value.",
            });
        }
        else if (!!tx.to === true && !!tx.data === true) {
            // Call Contract
            // @ts-ignore
            const needed = !!tx.value === true ? new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).plus(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toFixed(7) : new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(7);
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed);
                // Grab vins for transaction object.
                let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
                // @ts-ignore
                const [vins, amounts] = utils_2.addVins(utxos, needed, tx.from.split("0x")[1]);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = utils_2.addContractVouts(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), ethers_1.BigNumber.from(tx.gasLimit).toNumber(), tx.data, tx.to, amounts, !!tx.value === true ? new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toNumber() : new bignumber_js_1.BigNumber(ethers_1.BigNumber.from("0x0").toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) });
                });
                qtumTx.vins = updatedVins;
                // Build the serialized transaction string.
                const serialized = utils_2.txToBuffer(qtumTx).toString('hex');
                return serialized;
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
                    error: error,
                });
            }
        }
        else if (!!tx.to === true && !!tx.value === true && !!tx.data === false) {
            // P2PKH (send-to-address)
            // @ts-ignore
            const needed = new bignumber_js_1.BigNumber(global_vars_1.GLOBAL_VARS.MAX_FEE_RATE).plus(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toFixed(7);
            try {
                // @ts-ignore
                const utxos = await this.provider.getUtxos(tx.from, needed);
                // Grab vins for transaction object.
                let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
                // @ts-ignore
                const [vins, amounts] = utils_2.addVins(utxos, needed, tx.from.split("0x")[1]);
                qtumTx.vins = vins;
                // Grab contract vouts (scripts/p2pkh)
                // @ts-ignore
                qtumTx.vouts = utils_2.addp2pkhVouts(tx.to.split("0x")[1], amounts, new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
                // Calculate fee (per KB)
                // Sign necessary vins
                const updatedVins = qtumTx.vins.map((vin, index) => {
                    return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) });
                });
                qtumTx.vins = updatedVins;
                // Build the serialized transaction string.
                const serialized = utils_2.txToBuffer(qtumTx).toString('hex');
                return serialized;
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
                    error: error,
                });
            }
        }
        else {
            return logger.throwError("Unidentified error building your transaction, make sure the to, from, gasPrice, gasLimit, and data fields are correct.", utils_1.Logger.errors.NOT_IMPLEMENTED, {
                error: "Unidentified error building your transaction, make sure the to, from, gasPrice, gasLimit, and data fields are correct.",
            });
        }
    }
    ;
}
exports.QtumWallet = QtumWallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBc0Q7QUFDdEQsNENBRzBCO0FBRTFCLCtDQUF3QztBQUN4QywyQ0FBcUg7QUFDckgsdURBQW1EO0FBQ25ELHFFQUFpRTtBQUdqRSxNQUFNLE1BQU0sR0FBRyxJQUFJLGNBQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUV4QyxNQUFNLGFBQWEsR0FBRztJQUNsQixjQUFNLENBQUMsTUFBTSxDQUFDLGtCQUFrQjtDQUNuQyxDQUFDO0FBR0YsTUFBYSxVQUFXLFNBQVEsdUNBQWtCO0lBRTlDLDBGQUEwRjtJQUUxRixLQUFLLENBQUMsZUFBZSxDQUFDLFdBQStCO1FBQ2pELE1BQU0sb0JBQW9CLEdBQUcsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDekUsTUFBTSxFQUFFLEdBQUcsTUFBTSx5QkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRXpELGlGQUFpRjtRQUNqRixJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssS0FBSyxLQUFLLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO1lBQ2pFLG9CQUFvQjtZQUNwQixhQUFhO1lBQ2Isa0NBQWtDO1lBQ2xDLE1BQU0sTUFBTSxHQUFHLElBQUksd0JBQVMsQ0FBQyxJQUFJLHdCQUFTLENBQUMsa0JBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxrQkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENB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