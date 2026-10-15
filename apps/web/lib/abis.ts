import { parseAbi } from "viem";

export const factoryAbi = parseAbi([
  "function createToken(string name_, string symbol_, string metadataURI_) returns (address tokenAddress, address marketAddress)",
  "function marketForToken(address token) view returns (address market)",
  "function protocolFeeRecipient() view returns (address)",
  "event TokenCreated(address indexed creator,address indexed token,address indexed market,string name,string symbol,uint256 totalSupply,string metadataURI)",
]);

export const marketAbi = parseAbi([
  "function token() view returns (address)",
  "function creator() view returns (address)",
  "function realEthReserve() view returns (uint256)",
  "function realTokenReserve() view returns (uint256)",
  "function totalClaimableFees() view returns (uint256)",
  "function protocolFeeBps() view returns (uint16)",
  "function creatorFeeBps() view returns (uint16)",
  "function quoteBuy(uint256 grossEthIn) view returns (uint256 tokensOut,uint256 protocolFee,uint256 creatorFee)",
  "function quoteSell(uint256 tokensIn) view returns (uint256 ethOut,uint256 protocolFee,uint256 creatorFee)",
  "function buy(uint256 minTokensOut,uint256 deadline) payable returns (uint256 tokensOut)",
  "function sell(uint256 tokensIn,uint256 minEthOut,uint256 deadline) returns (uint256 ethOut)",
  "function claimableFees(address recipient) view returns (uint256 amount)",
  "function withdrawFees() returns (uint256 amount)",
  "event Buy(address indexed buyer,uint256 ethIn,uint256 tokensOut,uint256 protocolFee,uint256 creatorFee)",
  "event Sell(address indexed seller,uint256 tokensIn,uint256 ethOut,uint256 protocolFee,uint256 creatorFee)",
]);

export const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
]);
