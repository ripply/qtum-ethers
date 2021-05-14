"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContractAddress = exports.reverse = exports.contractTxScript = exports.p2pkhScript = exports.p2pkhScriptSig = exports.signp2pkh = exports.encodeSig = exports.toDER = exports.txToBuffer = exports.calcTxBytes = void 0;
const varuint_bitcoin_1 = require("varuint-bitcoin");
const pushdata = require('pushdata-bitcoin');
const bip66_1 = require("bip66");
const opcodes_1 = require("./helpers/opcodes");
const buffer_cursor_1 = require("./helpers/buffer-cursor");
const secp256k1_1 = require("secp256k1");
const bitcoinjs = require("bitcoinjs-lib");
const script_number_1 = require("bitcoinjs-lib/src/script_number");
const hash_js_1 = require("hash.js");
const toBuffer = require('typedarray-to-buffer');
const utils_1 = require("ethers/lib/utils");
function cloneBuffer(buffer) {
    let result = Buffer.alloc(buffer.length);
    buffer.copy(result);
    return result;
}
function cloneTx(tx) {
    let result = { version: tx.version, locktime: tx.locktime, vins: [], vouts: [] };
    for (let vin of tx.vins) {
        result.vins.push({
            txid: cloneBuffer(vin.txid),
            vout: vin.vout,
            hash: cloneBuffer(vin.hash),
            sequence: vin.sequence,
            script: cloneBuffer(vin.script),
            scriptSig: null
        });
    }
    for (let vout of tx.vouts) {
        result.vouts.push({
            script: cloneBuffer(vout.script),
            value: vout.value,
        });
    }
    return result;
}
// refer to https://en.bitcoin.it/wiki/Transaction#General_format_of_a_Bitcoin_transaction_.28inside_a_block.29
function calcTxBytes(vins, vouts) {
    console.log(2 + 1 + 1 + 4 + 32 + 4 + 1 + 4 + 107 + 8 + 1 + 253);
    return (2 + 1 + 1 + 4 + 32 + 4 + 1 + 4 + 107 + 8 + 1 + 253);
}
exports.calcTxBytes = calcTxBytes;
//CloneTx
function txToBuffer(tx) {
    // Issue calculatingTxBytes with contract script
    let buffer = Buffer.alloc(calcTxBytes(tx.vins, tx.vouts));
    let cursor = new buffer_cursor_1.BufferCursor(buffer);
    // version
    cursor.writeUInt32LE(tx.version);
    // vin length
    cursor.writeBytes(varuint_bitcoin_1.encode(tx.vins.length));
    // vin
    for (let vin of tx.vins) {
        cursor.writeBytes(vin.hash);
        // Issue with using 4, needed 5
        cursor.writeUInt32BE(vin.vout);
        if (vin.scriptSig !== null) {
            // cursor.writeBytes(encodeVaruint(vin.scriptSig.length));
            // cursor.writeBytes(vin.scriptSig);
        }
        else {
            // cursor.writeBytes(encodeVaruint(vin.script.length));
            // cursor.writeBytes(vin.script);
        }
        cursor.writeUInt32LE(4294967295);
    }
    // vout length
    cursor.writeBytes(varuint_bitcoin_1.encode(tx.vouts.length));
    // vouts
    for (let vout of tx.vouts) {
        console.log(vout.script.toString("hex"), 'voutScript');
        cursor.writeUInt64LE(vout.value);
        cursor.writeBytes(varuint_bitcoin_1.encode(Buffer.from("010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c1", "hex").length));
        cursor.writeBytes(Buffer.from("010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c1", "hex"));
    }
    // locktime
    cursor.writeUInt32LE(tx.locktime);
    return buffer;
}
exports.txToBuffer = txToBuffer;
// refer to: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script_signature.js
function toDER(x) {
    let i = 0;
    while (x[i] === 0)
        ++i;
    if (i === x.length)
        return Buffer.alloc(1);
    x = x.slice(i);
    if (x[0] & 0x80)
        return Buffer.concat([Buffer.alloc(1), x], 1 + x.length);
    return x;
}
exports.toDER = toDER;
// refer to: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script_signature.js
function encodeSig(signature, hashType) {
    const hashTypeMod = hashType & ~0x80;
    if (hashTypeMod <= 0 || hashTypeMod >= 4)
        throw new Error('Invalid hashType ' + hashType);
    const hashTypeBuffer = Buffer.from([hashType]);
    const bufferSignature = Buffer.from(signature);
    const r = toDER(bufferSignature.slice(0, 32));
    const s = toDER(bufferSignature.slice(32, 64));
    return Buffer.concat([bip66_1.encode(r, s), hashTypeBuffer]);
}
exports.encodeSig = encodeSig;
/////////////////////////////////////////
function signp2pkh(tx, vindex, privKey, hashType = 0x01) {
    let clone = cloneTx(tx);
    // clean up relevant script
    let filteredPrevOutScript = clone.vins[vindex].script.filter((op) => op !== opcodes_1.OPS.OP_CODESEPARATOR);
    // Uint8Array issue here
    clone.vins[vindex].script = toBuffer(filteredPrevOutScript);
    // zero out scripts of other inputs
    for (let i = 0; i < clone.vins.length; i++) {
        if (i === vindex)
            continue;
        clone.vins[i].script = Buffer.alloc(0);
    }
    // write to the buffer
    let buffer = txToBuffer(clone);
    // extend and append hash type
    buffer = Buffer.alloc(buffer.length + 4, buffer);
    // append the hash type
    buffer.writeInt32LE(hashType, buffer.length - 4);
    // double-sha256
    let firstHash = hash_js_1.sha256().update(buffer).digest();
    let secondHash = hash_js_1.sha256().update(firstHash).digest();
    // console.log(new Uint8Array(secondHash), 'secondHash')
    let sig = secp256k1_1.ecdsaSign(new Uint8Array(secondHash), utils_1.arrayify(privKey));
    // console.log(sig, 'sigHere')
    return encodeSig(sig.signature, hashType);
    // let signedp2pkh = p2pkhScriptSig(encoded, pubKey);
    // console.log(signedp2pkh)
    // Uint8Array.from(Buffer.from(secondHash, 'hex'));
    return secondHash;
    // sign input
    // console.log("signhere3")
    // encode
    // return encodeSig(sig.signature, hashType);
}
exports.signp2pkh = signp2pkh;
function p2pkhScriptSig(sig, pubkey) {
    return bitcoinjs.script.compile([sig, Buffer.from(pubkey, 'hex')]);
}
exports.p2pkhScriptSig = p2pkhScriptSig;
// Refer to:
// https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/payments/p2pkh.js#L58
function p2pkhScript(hash160PubKey) {
    // prettier-ignore
    return bitcoinjs.script.compile([
        opcodes_1.OPS.OP_DUP,
        opcodes_1.OPS.OP_HASH160,
        hash160PubKey,
        opcodes_1.OPS.OP_EQUALVERIFY,
        opcodes_1.OPS.OP_CHECKSIG
    ]);
}
exports.p2pkhScript = p2pkhScript;
// export function encodeCInt(number: number) {
//     var value = Math.abs(number)
//     var size = scriptNumSize(value)
//     var buffer = Buffer.allocUnsafe(size)
//     var negative = number < 0
//     for (var i = 0; i < size; ++i) {
//         buffer.writeUInt8(value & 0xff, i)
//         value >>= 8
//     }
//     if (buffer[size - 1] & 0x80) {
//         buffer.writeUInt8(negative ? 0x80 : 0x00, size - 1)
//     } else if (negative) {
//         buffer[size - 1] |= 0x80
//     }
//     return buffer
// }
// export function scriptNumSize(i: number) {
//     return i > 0x7fffffff ? 5
//         : i > 0x7fffff ? 4
//             : i > 0x7fff ? 3
//                 : i > 0x7f ? 2
//                     : i > 0x00 ? 1
//                         : 0
// }
function contractTxScript(contractAddress, gasLimit, gasPrice, encodedData) {
    // If contractAddress is missing, assume it's a create script, else assume its a call contract interaction
    if (contractAddress === "") {
        let scr = bitcoinjs.script.compile([
            opcodes_1.OPS.OP_4,
            script_number_1.encode(gasLimit),
            script_number_1.encode(gasPrice),
            Buffer.from(encodedData, "hex"),
            opcodes_1.OPS.OP_CREATE,
        ]).toString("hex");
        console.log("compiled", bitcoinjs.script.toASM(Buffer.from(scr, "hex")));
        // console.log("decompiledFirst", bitcoinjs.script.decompile(Buffer.from(scr, "hex")))
        console.log("decompiled", bitcoinjs.script.toASM(Buffer.from("010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c1", "hex")));
        return bitcoinjs.script.compile([
            84,
            script_number_1.encode(gasLimit),
            script_number_1.encode(gasPrice),
            Buffer.from(encodedData, "hex"),
            opcodes_1.OPS.OP_CREATE,
        ]);
    }
    else {
        return bitcoinjs.script.compile([
            opcodes_1.OPS.OP_4,
            script_number_1.encode(gasLimit),
            script_number_1.encode(gasPrice),
            Buffer.from(encodedData, "hex"),
            Buffer.from(contractAddress, "hex"),
            opcodes_1.OPS.OP_CALL,
        ]);
    }
}
exports.contractTxScript = contractTxScript;
function reverse(src) {
    var buffer = Buffer.alloc(src.length);
    for (var i = 0, j = src.length - 1; i <= j; ++i, --j) {
        buffer[i] = src[j];
        buffer[j] = src[i];
    }
    return buffer;
}
exports.reverse = reverse;
function generateContractAddress() {
    // 20 bytes
    let buffer = Buffer.alloc(32 + 4);
    let cursor = new buffer_cursor_1.BufferCursor(buffer);
    cursor.writeBytes(Buffer.from("4caa93a015ecf4e9fafd84c7cda2ad4897068777f29a1b1e1804e50553990c68", "hex"));
    cursor.writeUInt32LE(1);
    // console.log(Buffer.concat([Buffer.from("4caa93a015ecf4e9fafd84c7cda2ad4897068777f29a1b1e1804e50553990c68", "hex")]))
    return buffer.toString("hex");
}
exports.generateContractAddress = generateContractAddress;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbGliL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUEwRTtBQUMxRSxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUM3QyxpQ0FBK0I7QUFDL0IsK0NBQXdDO0FBQ3hDLDJEQUF1RDtBQUN2RCx5Q0FBc0M7QUFDdEMsMkNBQTRDO0FBQzVDLG1FQUFvRTtBQUNwRSxxQ0FBZ0M7QUFDaEMsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUE7QUFDaEQsNENBRTBCO0FBNEMxQixTQUFTLFdBQVcsQ0FBQyxNQUFjO0lBQy9CLElBQUksTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3pDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEIsT0FBTyxNQUFNLENBQUM7QUFDbEIsQ0FBQztBQUVELFNBQVMsT0FBTyxDQUFDLEVBQU87SUFDcEIsSUFBSSxNQUFNLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQU8sRUFBRSxFQUFFLEtBQUssRUFBTyxFQUFFLEVBQUUsQ0FBQztJQUMzRixLQUFLLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUU7UUFDckIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDYixJQUFJLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFDM0IsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO1lBQ2QsSUFBSSxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQzNCLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUTtZQUN0QixNQUFNLEVBQUUsV0FB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