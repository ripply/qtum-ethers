/// <reference types="node" />
export declare class BufferCursor {
    _buffer: any;
    _position: any;
    constructor(buffer: any);
    get position(): number;
    get eof(): boolean;
    get buffer(): Buffer;
    readUInt8(): any;
    readUInt16LE(): any;
    readUInt16BE(): any;
    readUInt32LE(): any;
    readUInt32BE(): any;
    readBytes(len: number): any;
    writeUInt8(val: any): void;
    writeUInt16LE(val: any): void;
    writeUInt16BE(val: any): void;
    writeUInt32LE(val: any): void;
    writeInt32LE(val: any): void;
    writeUInt32BE(val: any): void;
    writeUInt64LE(value: any): void;
    writeBytes(buffer: any): void;
    _readStandard(fn: any, len: any): any;
    _writeStandard(fn: any, val: any, len: any): void;
}
