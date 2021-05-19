declare const BigNumber: any;
declare const expect: any;
declare const ethers: any;
declare const QtumWallet: any;
declare const QtumProvider: any;
declare const QtumContractFactory: any;
declare const generateContractAddress: any;
declare const BYTECODE = "608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029";
declare const ABI: ({
    inputs: never[];
    name: string;
    outputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    stateMutability: string;
    type: string;
} | {
    inputs: {
        internalType: string;
        name: string;
        type: string;
    }[];
    name: string;
    outputs: never[];
    stateMutability: string;
    type: string;
})[];
declare const provider: any;
declare const signer: any;
declare const signerNoQtum: any;
declare const SIMPLEBANK_ABI: ({
    constant: boolean;
    inputs: {
        name: string;
        type: string;
    }[];
    name: string;
    outputs: {
        name: string;
        type: string;
    }[];
    payable: boolean;
    stateMutability: string;
    type: string;
    anonymous?: undefined;
} | {
    inputs: never[];
    payable: boolean;
    stateMutability: string;
    type: string;
    constant?: undefined;
    name?: undefined;
    outputs?: undefined;
    anonymous?: undefined;
} | {
    payable: boolean;
    stateMutability: string;
    type: string;
    constant?: undefined;
    inputs?: undefined;
    name?: undefined;
    outputs?: undefined;
    anonymous?: undefined;
} | {
    anonymous: boolean;
    inputs: {
        indexed: boolean;
        name: string;
        type: string;
    }[];
    name: string;
    type: string;
    constant?: undefined;
    outputs?: undefined;
    payable?: undefined;
    stateMutability?: undefined;
})[];
declare const SIMPLEBANK_BYTECODE = "608060405234801561001057600080fd5b5060018054600160a060020a031916331790556102a6806100326000396000f30060806040526004361061006c5763ffffffff7c01000000000000000000000000000000000000000000000000000000006000350416632e1a7d4d811461007e5780638da5cb5b146100a8578063b69ef8a8146100e6578063d0e30db0146100fb578063e65f2a7e14610103575b34801561007857600080fd5b50600080fd5b34801561008a57600080fd5b50610096600435610118565b60408051918252519081900360200190f35b3480156100b457600080fd5b506100bd6101b8565b6040805173ffffffffffffffffffffffffffffffffffffffff9092168252519081900360200190f35b3480156100f257600080fd5b506100966101d4565b6100966101e7565b34801561010f57600080fd5b50610096610262565b3360008181526020819052604081205490919083111561013757600080fd5b73ffffffffffffffffffffffffffffffffffffffff8116600081815260208190526040808220805487900390555185156108fc0291869190818181858888f1935050505015801561018c573d6000803e3d6000fd5b5073ffffffffffffffffffffffffffffffffffffffff1660009081526020819052604090205492915050565b60015473ffffffffffffffffffffffffffffffffffffffff1681565b3360009081526020819052604090205490565b3360008181526020818152604080832080543490810190915581518581529283015280519293927fa8126f7572bb1fdeae5b5aa9ec126438b91f658a07873f009d041ae690f3a1939281900390910190a173ffffffffffffffffffffffffffffffffffffffff16600090815260208190526040902054919050565b3360008181526020819052604090206103e8905531905600a165627a7a723058207150f304aba2c201f08d6f34333d8f050e2efc1858b574aff03f66a497b066610029";
