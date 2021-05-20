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
    /**
     * Override to build a raw QTUM transaction signing UTXO's
     */
    async signTransaction(transaction) {
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
        const { serializedTransaction, networkFee } = utils_2.serializeTransaction(utxos, neededAmount, tx, transactionType, this.privateKey, this.publicKey);
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
            const serialized = utils_2.serializeTransaction(utxos, neededAmount, tx, transactionType, this.publicKey, this.privateKey);
            return serialized.serializedTransaction;
        }
        return serializedTransaction;
        // Determine if this transaction is a contract creation, call, or send-to-address
        if (!!tx.to === false && !!tx.value === false && !!tx.data === true) {
            // Contract Creation
            // @ts-ignore
            // Calculate needed amount without tx fee taken into account as we do not have knowledge of projected TX size
            const needed = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber().toString() + `e-8`).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(7).toString();
            let utxos = [];
            try {
                // @ts-ignore
                utxos = await this.provider.getUtxos(tx.from, needed);
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
            // Building the QTUM tx that will eventually be serialized.
            let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
            // @ts-ignore
            const [vins, amounts] = utils_2.addVins(utxos, needed, tx.from.split("0x")[1]);
            qtumTx.vins = vins;
            // Grab contract vouts (scripts/p2pkh)
            // @ts-ignore
            let localVouts = utils_2.addContractVouts(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), ethers_1.BigNumber.from(tx.gasLimit).toNumber(), tx.data, "", amounts, new bignumber_js_1.BigNumber(ethers_1.BigNumber.from("0x0").toNumber() + `e-8`).toFixed(7), tx.from.split("0x")[1], qtumTx.vins);
            if (typeof localVouts === 'string') {
                try {
                    // @ts-ignore
                    let updatedUtxos = await this.provider.getUtxos(tx.from, new bignumber_js_1.BigNumber(needed).plus(localVouts));
                    // @ts-ignore
                    const [updatedVinsPlusFee, updatedAmounts] = utils_2.addVins(updatedUtxos, new bignumber_js_1.BigNumber(needed).plus(localVouts), tx.from.split("0x")[1]);
                    qtumTx.vins = updatedVinsPlusFee;
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
            }
            // Sign necessary vins
            const updatedVins = qtumTx.vins.map((vin, index) => {
                return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey), this.publicKey.split("0x")[1]) });
            });
            qtumTx.vins = updatedVins;
            // Build the serialized transaction string.
            const serialized = utils_2.txToBuffer(qtumTx).toString('hex');
            return serialized;
        }
        else if (!!tx.to === false && !!tx.value === true && !!tx.data === true) {
            return logger.throwError("You cannot send QTUM while deploying a contract. Try deploying again without a value.", utils_1.Logger.errors.NOT_IMPLEMENTED, {
                error: "You cannot send QTUM while deploying a contract. Try deploying again without a value.",
            });
        }
        else if (!!tx.to === true && !!tx.data === true) {
            // Call Contract
            // @ts-ignore
            // Calculate needed amount without tx fee taken into account as we do not have knowledge of projected TX size
            const needed = !!tx.value === true ? new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).plus(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toFixed(7) : new bignumber_js_1.BigNumber(new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7)).times(ethers_1.BigNumber.from(tx.gasLimit).toNumber()).toFixed(7);
            let utxos = [];
            try {
                // @ts-ignore
                utxos = await this.provider.getUtxos(tx.from, needed);
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
                    error: error,
                });
            }
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
        else if (!!tx.to === true && !!tx.value === true && !!tx.data === false) {
            // P2PKH (send-to-address)
            // @ts-ignore
            // Calculate needed amount without tx fee taken into account as we do not have knowledge of projected TX size
            const needed = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.value).toNumber() + `e-8`).toFixed(7);
            let utxos = [];
            try {
                // @ts-ignore
                utxos = await this.provider.getUtxos(tx.from, needed);
            }
            catch (error) {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }
                return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
                    error: error,
                });
            }
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
        else {
            return logger.throwError("Unidentified error building your transaction, make sure the to, from, gasPrice, gasLimit, and data fields are correct.", utils_1.Logger.errors.NOT_IMPLEMENTED, {
                error: "Unidentified error building your transaction, make sure the to, from, gasPrice, gasLimit, and data fields are correct.",
            });
        }
    }
    ;
}
exports.QtumWallet = QtumWallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBc0Q7QUFDdEQsNENBRzBCO0FBRTFCLCtDQUF3QztBQUN4QywyQ0FBaUs7QUFDakssdURBQW1EO0FBQ25ELHFFQUFpRTtBQUdqRSxNQUFNLE1BQU0sR0FBRyxJQUFJLGNBQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUV4QyxNQUFNLGFBQWEsR0FBRztJQUNsQixjQUFNLENBQUMsTUFBTSxDQUFDLGtCQUFrQjtDQUNuQyxDQUFDO0FBR0YsTUFBYSxVQUFXLFNBQVEsdUNBQWtCO0lBRTlDOztPQUVHO0lBQ0gsS0FBSyxDQUFDLGVBQWUsQ0FBQyxXQUErQjtRQUNqRCxNQUFNLEVBQUUsR0FBRyxNQUFNLHlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRWhELDhGQUE4RjtRQUM5RixNQUFNLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxHQUFHLDRCQUFvQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRW5FLG1GQUFtRjtRQUNuRixJQUFJLGVBQWUsS0FBSyx5QkFBVyxDQUFDLFlBQVksRUFBRTtZQUM5QyxPQUFPLE1BQU0sQ0FBQyxVQUFVLENBQ3BCLHVGQUF1RixFQUN2RixjQUFNLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFDN0I7Z0JBQ0ksS0FBSyxFQUFFLHVGQUF1RjthQUNqRyxDQUNKLENBQUM7U0FDTDtRQUVELElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQztRQUNmLElBQUk7WUFDQSxhQUFhO1lBQ2IsS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztZQUM1RCxvQ0FBb0M7U0FDdkM7UUFBQyxPQUFPLEtBQVUsRUFBRTtZQUNqQixJQUFJLGFBQWEsQ0FBQyxPQUFPLENBQUMs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