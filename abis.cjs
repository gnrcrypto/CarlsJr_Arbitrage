// ./abis.cjs
const FlashloanArbitrageurABI = require("./abis/arbitrage_contract_abi.json");
const ERC20 = require("./abis/erc20.json");
const AavePool = require("./abis/AavePool.json");
const Quick = require("./abis/QuickswapRouter.json");
const Sushi = require("./abis/SushiswapRouter.json");
const UniV3Router = require("./abis/UniswapV3Router.json");
const UniV3Quoter = require("./abis/UniswapV3Quoter.json");
const Pair = require("./abis/IUniswapV2Pair.json");

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
