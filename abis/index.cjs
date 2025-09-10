// abis/index.cjs
const FlashloanArbitrageurABI = require("./arbitrage_contract_abi.json");
const ERC20 = require("./erc20.json");
const AavePool = require("./AavePool.json");
const Quick = require("./QuickswapRouter.json");
const Sushi = require("./SushiswapRouter.json");
const UniV3Router = require("./UniswapV3Router.json");
const UniV3Quoter = require("./UniswapV3Quoter.json");
const Pair = require("./IUniswapV2Pair.json");

module.exports = {
  FlashloanArbitrageurABI,
  ERC20,
  AavePool,
  Quick,
  Sushi,
  UniV3Router,
  UniV3Quoter,
  Pair,
};
