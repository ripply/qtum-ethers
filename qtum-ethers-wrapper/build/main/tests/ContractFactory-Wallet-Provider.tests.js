"use strict";
const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("ethers");
const { QtumWallet } = require("../../build/main/lib/QtumWallet");
const { QtumProvider } = require("../../build/main/lib/QtumProvider");
const { QtumContractFactory, } = require("../../build/main/lib/QtumContractFactory");
const { generateContractAddress } = require('../../build/main/lib/helpers/utils');
const BYTECODE = "608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029";
const ABI = [{ "inputs": [], "name": "get", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "x", "type": "uint256" }], "name": "set", "outputs": [], "stateMutability": "nonpayable", "type": "function" }];
const provider = new QtumProvider("http://localhost:23889");
const signer = new QtumWallet("99dda7e1a59655c9e02de8592be3b914df7df320e72ce04ccf0427f9a366ec6e", provider);
const signerNoQtum = new QtumWallet("61fd08e21110d908cf8dc20bb243a96e2dc0d29169b4fec09594c39e4384125a", provider);
const SIMPLEBANK_ABI = [
    {
        "inputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "accountAddress",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "LogDepositMade",
        "type": "event"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "balance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [],
        "name": "deposit",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": true,
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "depositsBalance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [],
        "name": "enroll",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "internalType": "uint256",
                "name": "withdrawAmount",
                "type": "uint256"
            }
        ],
        "name": "withdraw",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "remainingBal",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
const SIMPLEBANK_BYTECODE = "608060405234801561001057600080fd5b50600280546001600160a01b031916331790556000805460ff1916905561028c8061003c6000396000f3fe6080604052600436106100555760003560e01c8063138fbe711461005a5780632e1a7d4d146100815780638da5cb5b146100ab578063b69ef8a8146100dc578063d0e30db0146100f1578063e65f2a7e146100f9575b600080fd5b34801561006657600080fd5b5061006f61010e565b60408051918252519081900360200190f35b34801561008d57600080fd5b5061006f600480360360208110156100a457600080fd5b5035610112565b3480156100b757600080fd5b506100c061017e565b604080516001600160a01b039092168252519081900360200190f35b3480156100e857600080fd5b5061006f61018d565b61006f6101a0565b34801561010557600080fd5b5061006f610204565b4790565b3360009081526001602052604081205482116101695733600081815260016020526040808220805486900390555184156108fc0291859190818181858888f19350505050158015610167573d6000803e3d6000fd5b505b50503360009081526001602052604090205490565b6002546001600160a01b031681565b3360009081526001602052604090205490565b336000818152600160209081526040808320805434908101909155815190815290519293927fa8126f7572bb1fdeae5b5aa9ec126438b91f658a07873f009d041ae690f3a193929181900390910190a2503360009081526001602052604090205490565b60008054600360ff9091161015610243576000805460ff198116600160ff928316810190921617825533825260205260409020678ac7230489e8000090555b50336000908152600160205260409020549056fea265627a7a723158205098a98dd8e3ed9f67c9b25ab91302536280403498af2496b001d2763e4ac3e464736f6c63430005110032";
const QRC20_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_spender",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "name": "success",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_from",
                "type": "address"
            },
            {
                "name": "_to",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "name": "success",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "name": "",
                "type": "uint8"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "standard",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_to",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "name": "success",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "",
                "type": "address"
            },
            {
                "name": "",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "payable": true,
        "stateMutability": "payable",
        "type": "fallback"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "name": "_from",
                "type": "address"
            },
            {
                "indexed": true,
                "name": "_to",
                "type": "address"
            },
            {
                "indexed": false,
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "name": "_owner",
                "type": "address"
            },
            {
                "indexed": true,
                "name": "_spender",
                "type": "address"
            },
            {
                "indexed": false,
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    }
];
const QRC20_BYTECODE = "608060405267016345785d8a000060005534801561001c57600080fd5b5060008054338252600160205260409091205561064e8061003e6000396000f3006080604052600436106100a35763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166306fdde0381146100a8578063095ea7b31461013257806318160ddd1461016a57806323b872dd14610191578063313ce567146101bb5780635a3b7e42146101e657806370a08231146101fb57806395d89b411461021c578063a9059cbb14610231578063dd62ed3e14610255575b600080fd5b3480156100b457600080fd5b506100bd61027c565b6040805160208082528351818301528351919283929083019185019080838360005b838110156100f75781810151838201526020016100df565b50505050905090810190601f1680156101245780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561013e57600080fd5b50610156600160a060020a03600435166024356102b3565b604080519115158252519081900360200190f35b34801561017657600080fd5b5061017f61036c565b60408051918252519081900360200190f35b34801561019d57600080fd5b50610156600160a060020a0360043581169060243516604435610372565b3480156101c757600080fd5b506101d061049b565b6040805160ff9092168252519081900360200190f35b3480156101f257600080fd5b506100bd6104a0565b34801561020757600080fd5b5061017f600160a060020a03600435166104d7565b34801561022857600080fd5b506100bd6104e9565b34801561023d57600080fd5b50610156600160a060020a0360043516602435610520565b34801561026157600080fd5b5061017f600160a060020a03600435811690602435166105dd565b60408051808201909152600881527f5152432054455354000000000000000000000000000000000000000000000000602082015281565b600082600160a060020a03811615156102cb57600080fd5b8215806102f95750336000908152600260209081526040808320600160a060020a0388168452909152902054155b151561030457600080fd5b336000818152600260209081526040808320600160a060020a03891680855290835292819020879055805187815290519293927f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925929181900390910190a35060019392505050565b60005481565b600083600160a060020a038116151561038a57600080fd5b83600160a060020a03811615156103a057600080fd5b600160a060020a03861660009081526002602090815260408083203384529091529020546103ce90856105fa565b600160a060020a03871660008181526002602090815260408083203384528252808320949094559181526001909152205461040990856105fa565b600160a060020a038088166000908152600160205260408082209390935590871681522054610438908561060c565b600160a060020a0380871660008181526001602090815260409182902094909455805188815290519193928a16927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a350600195945050505050565b600881565b60408051808201909152600981527f546f6b656e20302e310000000000000000000000000000000000000000000000602082015281565b60016020526000908152604090205481565b60408051808201909152600381527f5154430000000000000000000000000000000000000000000000000000000000602082015281565b600082600160a060020a038116151561053857600080fd5b3360009081526001602052604090205461055290846105fa565b3360009081526001602052604080822092909255600160a060020a0386168152205461057e908461060c565b600160a060020a0385166000818152600160209081526040918290209390935580518681529051919233927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9281900390910190a35060019392505050565b600260209081526000928352604080842090915290825290205481565b60008183101561060657fe5b50900390565b60008282018381101561061b57fe5b93925050505600a165627a7a723058205a85b8080447e6cd22c9bed1d6191938dd5fc3c5076a23629371c7cd6770576b0029";
const CHAINLINK_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "id",
                "type": "bytes32"
            }
        ],
        "name": "ChainlinkCancelled",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "id",
                "type": "bytes32"
            }
        ],
        "name": "ChainlinkFulfilled",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "id",
                "type": "bytes32"
            }
        ],
        "name": "ChainlinkRequested",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "requestId",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "int256",
                "name": "change",
                "type": "int256"
            }
        ],
        "name": "RequestEthereumChangeFulfilled",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "requestId",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "market",
                "type": "bytes32"
            }
        ],
        "name": "RequestEthereumLastMarket",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "requestId",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "price",
                "type": "uint256"
            }
        ],
        "name": "RequestEthereumPriceFulfilled",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "_requestId",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "_payment",
                "type": "uint256"
            },
            {
                "internalType": "bytes4",
                "name": "_callbackFunctionId",
                "type": "bytes4"
            },
            {
                "internalType": "uint256",
                "name": "_expiration",
                "type": "uint256"
            }
        ],
        "name": "cancelRequest",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "changeDay",
        "outputs": [
            {
                "internalType": "int256",
                "name": "",
                "type": "int256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "currentPrice",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "_requestId",
                "type": "bytes32"
            },
            {
                "internalType": "int256",
                "name": "_change",
                "type": "int256"
            }
        ],
        "name": "fulfillEthereumChange",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "_requestId",
                "type": "bytes32"
            },
            {
                "internalType": "bytes32",
                "name": "_market",
                "type": "bytes32"
            }
        ],
        "name": "fulfillEthereumLastMarket",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "_requestId",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "_price",
                "type": "uint256"
            }
        ],
        "name": "fulfillEthereumPrice",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getChainlinkToken",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "isOwner",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "lastMarket",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_oracle",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_jobId",
                "type": "string"
            }
        ],
        "name": "requestEthereumChange",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_oracle",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_jobId",
                "type": "string"
            }
        ],
        "name": "requestEthereumLastMarket",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_oracle",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_jobId",
                "type": "string"
            }
        ],
        "name": "requestEthereumPrice",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "withdrawLink",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
const CHAINLINK_BYTECODE = "6080604052600160045534801561001557600080fd5b50600680546001600160a01b0319163317908190556040516001600160a01b0391909116906000907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908290a36100736001600160e01b0361007816565b610126565b61010273c89bd4e1632d3a43cb03aaad5262cbe4038bc5716001600160a01b03166338cc48316040518163ffffffff1660e01b815260040160206040518083038186803b1580156100c857600080fd5b505afa1580156100dc573d6000803e3d6000fd5b505050506040513d60208110156100f257600080fd5b50516001600160e01b0361010416565b565b600280546001600160a01b0319166001600160a01b0392909216919091179055565b6119a480620001366000396000f3fe608060405234801561001057600080fd5b50600436106100f55760003560e01c806392cdaaf311610097578063e9edbf0311610066578063e9edbf0314610343578063ec65d0f81461034b578063f2fde38b14610384578063f3bdf8ba146103aa576100f5565b806392cdaaf31461023f5780639d1b464a14610262578063a46fbe1a1461026a578063ab643c101461028d576100f5565b8063619cba1a116100d3578063619cba1a1461015d5780638da5cb5b146102135780638dc654a21461021b5780638f32d59b14610223576100f5565b8063165d35e1146100fa5780632183abd11461011e57806349556aff14610138575b600080fd5b610102610460565b604080516001600160a01b039092168252519081900360200190f35b61012661046f565b60408051918252519081900360200190f35b61015b6004803603604081101561014e57600080fd5b5080359060200135610475565b005b61015b6004803603604081101561017357600080fd5b6001600160a01b03823516919081019060408101602082013564010000000081111561019e57600080fd5b8201836020820111156101b057600080fd5b803590602001918460018302840111640100000000831117156101d257600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550610543945050505050565b6101026106a5565b61015b6106b4565b61022b610848565b604080519115158252519081900360200190f35b61015b6004803603604081101561025557600080fd5b5080359060200135610859565b610126610927565b61015b6004803603604081101561028057600080fd5b508035906020013561092d565b61015b600480360360408110156102a357600080fd5b6001600160a01b0382351691908101906040810160208201356401000000008111156102ce57600080fd5b8201836020820111156102e057600080fd5b8035906020019184600183028401116401000000008311171561030257600080fd5b91908080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920191909152509295506109fb945050505050565b610126610b27565b61015b6004803603608081101561036157600080fd5b508035906020810135906001600160e01b03196040820135169060600135610b2d565b61015b6004803603602081101561039a57600080fd5b50356001600160a01b0316610b80565b61015b600480360360408110156103c057600080fd5b6001600160a01b0382351691908101906040810160208201356401000000008111156103eb57600080fd5b8201836020820111156103fd57600080fd5b8035906020019184600183028401116401000000008311171561041f57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550610bd0945050505050565b600061046a610dd2565b905090565b60085481565b60008281526005602052604090205482906001600160a01b031633146104cc5760405162461bcd60e51b81526004018080602001828103825260288152602001806118fe6028913960400191505060405180910390fd5b60008181526005602052604080822080546001600160a01b03191690555182917f7cc135e0cebb02c3480ae5d74d377283180a2601f8f644edf7987b009316c63a91a2604051829084907f1a7783cfc5355cd0706abec2229662cda9cefcfc8aeb31fec8b391ba5eb67cbe90600090a35060095550565b61054b610848565b61058a576040805162461bcd60e51b815260206004820181905260248201526000805160206118de833981519152604482015290519081900360640190fd5b610592611806565b6105ac61059e83610de1565b30635237df0d60e11b610e03565b90506105f46040518060400160405280600381526020016219d95d60ea1b8152506040518060800160405280604981526020016119266049913983919063ffffffff610e2e16565b61065a604051806040016040528060048152602001630e0c2e8d60e31b8152506040518060400160405280601881526020017f5241572e4554482e5553442e4348414e4745504354444159000000000000000081525083610e2e9092919063ffffffff16565b60408051808201909152600581526474696d657360d81b602082015261068c908290633b9aca0063ffffffff610e5d16565b61069f8382670de0b6b3a7640000610e87565b50505050565b6006546001600160a01b031690565b6106bc610848565b6106fb576040805162461bcd60e51b815260206004820181905260248201526000805160206118de833981519152604482015290519081900360640190fd5b6000610705610dd2565b604080516370a0823160e01b815230600482015290519192506001600160a01b0383169163a9059cbb91339184916370a08231916024808301926020929190829003018186803b15801561075857600080fd5b505afa15801561076c573d6000803e3d6000fd5b505050506040513d602081101561078257600080fd5b5051604080516001600160e01b031960e086901b1681526001600160a01b03909316600484015260248301919091525160448083019260209291908290030181600087803b1580156107d357600080fd5b505af11580156107e7573d6000803e3d6000fd5b505050506040513d60208110156107fd57600080fd5b5051610845576040805162461bcd60e51b81526020600482015260126024820152712ab730b13632903a37903a3930b739b332b960711b604482015290519081900360640190fd5b50565b6006546001600160a01b0316331490565b60008281526005602052604090205482906001600160a01b031633146108b05760405162461bcd60e51b81526004018080602001828103825260288152602001806118fe6028913960400191505060405180910390fd5b60008181526005602052604080822080546001600160a01b03191690555182917f7cc135e0cebb02c3480ae5d74d377283180a2601f8f644edf7987b009316c63a91a2604051829084907f794eb9e29f6750ede99e05248d997a9ab9fa23c4a7eaff8afa729080eb7c642890600090a35060075550565b60075481565b60008281526005602052604090205482906001600160a01b031633146109845760405162461bcd60e51b81526004018080602001828103825260288152602001806118fe6028913960400191505060405180910390fd5b60008181526005602052604080822080546001600160a01b03191690555182917f7cc135e0cebb02c3480ae5d74d377283180a2601f8f644edf7987b009316c63a91a2604051829084907f36f03c766dbeb725bf2a1e6cf2d934a02bf3cd9644b55767c8f41ef2d4af061290600090a35060085550565b610a03610848565b610a42576040805162461bcd60e51b815260206004820181905260248201526000805160206118de833981519152604482015290519081900360640190fd5b610a4a611806565b610a64610a5683610de1565b306392cdaaf360e01b610e03565b9050610aac6040518060400160405280600381526020016219d95d60ea1b8152506040518060600160405280603f815260200161189f603f913983919063ffffffff610e2e16565b610af8604051806040016040528060048152602001630e0c2e8d60e31b815250604051806040016040528060038152602001621554d160ea1b81525083610e2e9092919063ffffffff16565b60408051808201909152600581526474696d657360d81b602082015261068c908290606463ffffffff610e5d16565b60095481565b610b35610848565b610b74576040805162461bcd60e51b815260206004820181905260248201526000805160206118de833981519152604482015290519081900360640190fd5b61069f8484848461105e565b610b88610848565b610bc7576040805162461bcd60e51b815260206004820181905260248201526000805160206118de833981519152604482015290519081900360640190fd5b61084581611136565b610bd8610848565b610c17576040805162461bcd60e51b815260206004820181905260248201526000805160206118de833981519152604482015290519081900360640190fd5b610c1f611806565b610c39610c2b83610de1565b306349556aff60e01b610e03565b9050610c816040518060400160405280600381526020016219d95d60ea1b8152506040518060800160405280604981526020016119266049913983919063ffffffff610e2e16565b60408051600480825260a08201909252606091816020015b6060815260200190600190039081610c995790505090506040518060400160405280600381526020016252415760e81b81525081600081518110610cd957fe5b60200260200101819052506040518060400160405280600381526020016208aa8960eb1b81525081600181518110610d0d57fe5b6020026020010181905250604051806040016040528060038152602001621554d160ea1b81525081600281518110610d4157fe5b60200260200101819052506040518060400160405280600a815260200169131054d513505492d15560b21b81525081600381518110610d7c57fe5b6020026020010181905250610db8604051806040016040528060048152602001630e0c2e8d60e31b81525082846111d79092919063ffffffff16565b610dcb8483670de0b6b3a7640000610e87565b5050505050565b6002546001600160a01b031690565b80516000908290610df6575060009050610dfe565b505060208101515b919050565b610e0b611806565b610e13611806565b610e258186868663ffffffff61124516565b95945050505050565b6080830151610e43908363ffffffff61128216565b6080830151610e58908263ffffffff61128216565b505050565b6080830151610e72908363ffffffff61128216565b6080830151610e58908263ffffffff61129f16565b6004546040805130606090811b60208084019190915260348084018690528451808503909101815260549093018452825192810192909220908601939093526000838152600590915281812080546001600160a01b0319166001600160a01b038816179055905182917fb5e6e01e79f91267dc17b4e6314d5d4d03593d2ceee0fbb452b750bd70ea5af991a26002546001600160a01b0316634000aea08584610f2f876112fe565b6040518463ffffffff1660e01b815260040180846001600160a01b03166001600160a01b0316815260200183815260200180602001828103825283818151815260200191508051906020019080838360005b83811015610f99578181015183820152602001610f81565b50505050905090810190601f168015610fc65780820380516001836020036101000a031916815260200191505b50945050505050602060405180830381600087803b158015610fe757600080fd5b505af1158015610ffb573d6000803e3d6000fd5b505050506040513d602081101561101157600080fd5b505161104e5760405162461bcd60e51b815260040180806020018281038252602381526020018061187c6023913960400191505060405180910390fd5b6004805460010190559392505050565b60008481526005602052604080822080546001600160a01b0319811690915590516001600160a01b039091169186917fe1fe3afa0f7f761ff0a8b89086790efd5140d2907ebd5b7ff6bfcb5e075fd4c59190a260408051636ee4d55360e01b815260048101879052602481018690526001600160e01b0319851660448201526064810184905290516001600160a01b03831691636ee4d55391608480830192600092919082900301818387803b15801561111757600080fd5b505af115801561112b573d6000803e3d6000fd5b505050505050505050565b6001600160a01b03811661117b5760405162461bcd60e51b81526004018080602001828103825260268152602001806118566026913960400191505060405180910390fd5b6006546040516001600160a01b038084169216907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e090600090a3600680546001600160a01b0319166001600160a01b0392909216919091179055565b60808301516111ec908363ffffffff61128216565b6111f98360800151611427565b60005b81518110156112375761122f82828151811061121457fe5b6020026020010151856080015161128290919063ffffffff16565b6001016111fc565b50610e588360800151611432565b61124d611806565b61125d856080015161010061143d565b50509183526001600160a01b031660208301526001600160e01b031916604082015290565b61128f826003835161147d565b610e58828263ffffffff61158716565b67ffffffffffffffff198112156112bf576112ba82826115a8565b6112fa565b67ffffffffffffffff8113156112d9576112ba82826115e7565b600081126112ed576112ba8260008361147d565b6112fa826001831961147d565b5050565b8051602080830151604080850151606086810151608088015151935160006024820181815260448301829052606483018a90526001600160a01b03881660848401526001600160e01b0319861660a484015260c48301849052600160e48401819052610100610104850190815288516101248601528851969b6320214ca360e11b9b949a8b9a91999098909796939591949361014401918501908083838e5b838110156113b557818101518382015260200161139d565b50505050905090810190601f1680156113e25780820380516001836020036101000a031916815260200191505b5060408051601f198184030181529190526020810180516001600160e01b03166001600160e01b0319909d169c909c17909b5250989950505050505050505050919050565b610845816004611622565b610845816007611622565b61144561183b565b602082061561145a5760208206602003820191505b506020808301829052604080518085526000815283019091019052815b92915050565b601781116114a45761149e8360e0600585901b16831763ffffffff61163d16565b50610e58565b60ff81116114da576114c7836018611fe0600586901b161763ffffffff61163d16565b5061149e8382600163ffffffff61165516565b61ffff8111611511576114fe836019611fe0600586901b161763ffffffff61163d16565b5061149e8382600263ffffffff61165516565b63ffffffff811161154a5761153783601a611fe0600586901b161763ffffffff61163d16565b5061149e8382600463ffffffff61165516565b67ffffffffffffffff8111610e585761157483601b611fe0600586901b161763ffffffff61163d16565b5061069f8382600863ffffffff61165516565b61158f61183b565b6115a183846000015151848551611676565b9392505050565b6115b98260c363ffffffff61163d16565b506112fa82826000190360405160200180828152602001915050604051602081830303815290604052611722565b6115f88260c263ffffffff61163d16565b506112fa828260405160200180828152602001915050604051602081830303815290604052611722565b610e5882601f611fe0600585901b161763ffffffff61163d16565b61164561183b565b6115a1838460000151518461172f565b61165d61183b565b61166e84856000015151858561177a565b949350505050565b61167e61183b565b825182111561168c57600080fd5b846020015182850111156116b6576116b6856116ae87602001518786016117d8565b6002026117ef565b6000808651805187602083010193508088870111156116d55787860182525b505050602084015b602084106116fc5780518252601f1990930192602091820191016116dd565b51815160001960208690036101000a019081169019919091161790525083949350505050565b61128f826002835161147d565b61173761183b565b83602001518310611753576117538485602001516002026117ef565b835180516020858301018481535080851415611770576001810182525b5093949350505050565b61178261183b565b8460200151848301111561179f5761179f858584016002026117ef565b60006001836101000a0390508551838682010185831982511617815250805184870111156117cd5783860181525b509495945050505050565b6000818311156117e9575081611477565b50919050565b81516117fb838361143d565b5061069f8382611587565b6040805160a08101825260008082526020820181905291810182905260608101919091526080810161183661183b565b905290565b60405180604001604052806060815260200160008152509056fe4f776e61626c653a206e6577206f776e657220697320746865207a65726f2061646472657373756e61626c6520746f207472616e73666572416e6443616c6c20746f206f7261636c6568747470733a2f2f6d696e2d6170692e63727970746f636f6d706172652e636f6d2f646174612f70726963653f6673796d3d455448267473796d733d5553444f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572536f75726365206d75737420626520746865206f7261636c65206f6620746865207265717565737468747470733a2f2f6d696e2d6170692e63727970746f636f6d706172652e636f6d2f646174612f70726963656d756c746966756c6c3f6673796d733d455448267473796d733d555344a2646970667358221220a67f5d5bfd650f1ee2affa491b71e5b0c10f5772ac09725fd3e900a8ac171d6b64736f6c63430006000033";
describe("QtumContractFactory", function () {
    it("QtumContractFactory should deploy correctly given the deployer has enough QTUM to cover gas", async function () {
        const simpleStore = new QtumContractFactory(ABI, BYTECODE, signer);
        const deployment = await simpleStore.deploy({
            gasLimit: "0x2dc6c0", gasPrice: "0x28"
        });
        expect(deployment.address).to.equal(`0x${generateContractAddress(deployment.deployTransaction.hash.split("0x")[1])}`);
        await deployment.deployed();
        const getVal = await deployment.get({
            gasLimit: "0x2dc6c0", gasPrice: "0x28"
        });
        expect(BigNumber.from(getVal).toNumber()).to.equal(BigNumber.from("0x00").toNumber());
        const setVal = await deployment.set(1001, {
            gasLimit: "0x2dc6c0", gasPrice: "0x28"
        });
        const result = await setVal.wait();
        console.log(setVal, 'setVal', result, 'result');
        expect(BigNumber.from(getVal).toNumber()).to.equal(BigNumber.from("0x00").toNumber());
    });
    it("QtumContractFactory can be connected to a QtumWallet signer.", async function () {
        const simpleStore = new QtumContractFactory(ABI, BYTECODE);
        const connectedSimpleStore = simpleStore.connect(signer);
        if (!!connectedSimpleStore.signer) {
            const deployment = await connectedSimpleStore.deploy({
                gasLimit: "0x2dc6c0",
                gasPrice: "0x28",
            });
            expect(!!deployment.address, "true");
            await deployment.deployed();
            const getVal = await deployment.get({
                gasLimit: "0x2dc6c0", gasPrice: "0x28"
            });
            expect(BigNumber.from(getVal).toNumber()).to.equal(BigNumber.from("0x00").toNumber());
        }
    });
    // it("QtumContractFactory should reject if the deployer tries sending a value", async function () {
    //     const simpleStore = new QtumContractFactory(ABI, BYTECODE, signer);
    //     try {
    //         await simpleStore.deploy({
    //             gasLimit: "0x2dc6c0", gasPrice: "0x28", value: "0xffffff"
    //         });
    //     } catch (err) {
    //         expect(err.reason).to.equal("You cannot send QTUM while deploying a contract. Try deploying again without a value.")
    //     }
    // });
    // it("QtumContractFactory should fail as the deployer has no UTXOs to spend", async function () {
    //     const simpleStore = new QtumContractFactory(ABI, BYTECODE, signerNoQtum);
    //     try {
    //         await simpleStore.deploy({
    //             gasLimit: "0x2dc6c0", gasPrice: "0x28"
    //         });
    //     } catch (err) {
    //         expect(err.reason).to.equal("Needed amount of UTXO's exceed the total you own.")
    //     }
    // });
});
describe("QtumWallet", function () {
    // it("QtumWallet can send valid transactions to hash160 addresses", async function () {
    //     // sending to 0x7926223070547D2D15b2eF5e7383E541c338FfE9
    //     // const simulateSendTo = await signer.sendTransaction({
    //     //     to: "0x7926223070547D2D15b2eF5e7383E541c338FfE9",
    //     //     from: signer.address,
    //     //     gasLimit: "0x3d090",
    //     //     gasPrice: "0x28",
    //     //     value: "0xfffff",
    //     //     data: "",
    //     // });
    //     expect(true, "true")
    //     // const result = await simulateSendTo.wait()
    //     // console.log(result)
    // });
    // it("QtumWallet can call getAddress method with a valid private key provided to the signer", async function () {
    //     const address = await signer.getAddress();
    //     expect(address).to.equal(signer.address)
    // });
    it("QtumWallet can connect to SimpleBank and call a payable method", async function () {
        const simpleBank = new QtumContractFactory(SIMPLEBANK_ABI, SIMPLEBANK_BYTECODE, signer);
        const deployment = await simpleBank.deploy({
            gasLimit: "0x2dc6c0", gasPrice: "0x28"
        });
        expect(deployment.address).to.equal(`0x${generateContractAddress(deployment.deployTransaction.hash.split("0x")[1])}`);
        await deployment.deployed();
        // console.log(deployment)
        const deposit = await deployment.deposit({
            gasLimit: "0x2dc6c0", gasPrice: "0x28", value: "0xfffff"
        });
        await deposit.wait();
        console.log(deposit, 'deposit');
    });
    it("QtumWallet can connect to QRC20 ", async function () {
        const simpleBank = new QtumContractFactory(QRC20_ABI, QRC20_BYTECODE, signer);
        const deployment = await simpleBank.deploy({
            gasLimit: "0x2dc6c0", gasPrice: "0x28"
        });
        console.log(`0x${generateContractAddress(deployment.deployTransaction.hash.split("0x")[1])}`);
        expect(deployment.address).to.equal(`0x${generateContractAddress(deployment.deployTransaction.hash.split("0x")[1])}`);
        await deployment.deployed();
        // console.log(deployed.address)
        // console.log(deployment)
        const deposit = await deployment.name({ gasLimit: "0x2dc6c0", gasPrice: "0x28" });
        console.log(deposit);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29udHJhY3RGYWN0b3J5LVdhbGxldC1Qcm92aWRlci50ZXN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy90ZXN0cy9Db250cmFjdEZhY3RvcnktV2FsbGV0LVByb3ZpZGVyLnRlc3RzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsT0FBTyxDQUFDLDBCQUEwQixDQUFDLENBQUM7QUFDMUQsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ3BDLE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxPQUFPLENBQUMsaUNBQWlDLENBQUMsQ0FBQztBQUNsRSxNQUFNLEVBQUUsWUFBWSxFQUFFLEdBQUcsT0FBTyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7QUFDdEUsTUFBTSxFQUNGLG1CQUFtQixHQUN0QixHQUFHLE9BQU8sQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0FBQ3hELE1BQU0sRUFBRSx1QkFBdUIsRUFBRSxHQUFHLE9BQU8sQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFBO0FBQ2pGLE1BQU0sUUFBUSxHQUFHLHNlQUFzZSxDQUFBO0FBQ3ZmLE1BQU0sR0FBRyxHQUFHLENBQUMsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxT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