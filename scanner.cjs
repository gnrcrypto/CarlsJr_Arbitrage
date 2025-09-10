const { ethers } = require("ethers");
const Quick = require("./abis/QuickswapRouter.json");
const Sushi = require("./abis/SushiswapRouter.json");
const UniV3Quoter = require("./abis/UniswapV3Quoter.json");
const FlashloanExecutor = require("./executor.cjs");
const config = require("./config/path-polygon.json");

// Token definitions from the users provided list
const TOKENS = {
  WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  USDCe: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  AAVE: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
  USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  LINK: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
  GNS: '0xE5417Af564e4bFDA1c483642db72007871397896',
  OM: '0xc3ec80343d2bae2f8e680fdadde7c17e71e114ea',
  SAND: '0xbbba073c31bf03b8acf7c28ef0738decf3695683',
  QUICK: '0xb5c064f955d8e7f38fe0460c556a72987494ee17',
  UNI: '0xb33eaad8d922b1083446dc23f610c2567fb5180f',
  MANA: '0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4',
  BAL: '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3',
  GRT: '0x5fe2b58c013d7601147dcdd68c143a77499f5531',
  SNX: '0x50b728d8d964fd00c2d0aad81718b71311fef68a',
  GHST: '0x385eeac5cb85a38a9a07a70c73e0a3271cfb54a7',
  AVAX: '0x2c89bbc92bd86f8075d1decc58c7f4e0107f286b',
  CRV: '0x172370d5cd63279efa6d502dab29171933a610af',
  SUSHI: '0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a',
  SOL: '0x7dff46370e9ea5f0bad3c4e29711ad50062ea7a4',
  PAXG: '0x553d3d295e0f695b9228246232edf400ed3560b5',
  WSTETH: '0x03b54a6e9a984069379fae1a4fc4dbae93b3bccd',
  LDO: '0xC3C7d422809852031b44ab29EEC9F1EfF2A58756',
  FRAX: '0x45c32fa6df82ead1e2ef74d17b76547eddfaff89',
  FXS: '0x1a3acf6d19267e2d3e7f898f42803e90c9219062'
};

// DEX definitions from the users provided list
const DEXES = {
  QUICKSWAP: {
    address: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
    name: 'quickswap',
    type: "v2"
  },
  SUSHISWAP: {
    address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    name: 'sushiswap',
    type: "v2"
  },
  UNISWAP_V3: {
    address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    name: 'uniswapv3',
    type: "v3"
  },
  QUICKSWAP_V3: {
    address: '0xf5b509bB0909a69B1c207E495f687a596C168E12',
    name: 'quickswapv3',
    type: "v3"
  },
  MESHSWAP: {
    address: '0x10f4A785F458Bc144e3706575924889954946639',
    name: 'meshswap',
    type: "v2"
  }
};

// ABIs - assuming standard interfaces for common DEX types
const IUniswapV2RouterABI = Quick;
const IUniswapV3QuoterABI = UniV3Quoter;
const IBalancerVaultABI = [
  "function getPoolTokens(bytes32 poolId) external view returns (address[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock)",
  "function swap(tuple(bytes32 poolId, uint256 kind, address assetIn, address assetOut, uint256 amount, bytes userData) singleSwap, tuple(address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds, uint256 limit, uint256 deadline) external payable returns (uint256 amountOut)",
];
const ICurveRouterABI = [
  "function get_best_rate(address token_in, address token_out, uint256 amount_in) external view returns (address pool, uint256 rate)",
  "function exchange(address token_in, address token_out, uint256 amount_in, uint256 min_amount_out) external returns (uint256)",
];

class OpportunityScanner {
  constructor() {
    console.log("🔄 Initializing OpportunityScanner...");

    this.provider = new ethers.providers.JsonRpcProvider(
      process.env.POLYGON_RPC_URL || "https://polygon-rpc.com"
    );
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    let arbitrageABI;
    try {
      arbitrageABI = require("./abis/arbitrage_contract_abi.json");
    } catch (error) {
      console.error("❌ Failed to load ABI:", error.message);
      process.exit(1);
    }

    this.executor = new FlashloanExecutor({
      provider: this.provider,
      wallet: wallet,
      arbitrageContractAddress: process.env.ARB_CONTRACT_ADDRESS,
      arbitrageABI: arbitrageABI
    });

    this.minBps = config.minBasisPointsPerTrade || 50;

    this.uniV3Quoter = new ethers.Contract(
      '0xb27308f9f90d607463bb33ea1bebb41c27ce5ab6',
      IUniswapV3QuoterABI,
      this.provider
    );
    console.log("🎯 Min profit BPS:", this.minBps);
  }

  start() {
    console.log("🔍 Starting arbitrage scanner...");
    this._startPricePolling();
  }

  _startPricePolling() {
    console.log("⏰ Starting price polling every 5 seconds...");
    setInterval(() => this._scanForOpportunities(), 5000);
  }

  async _scanForOpportunities() {
    console.log("🔄 Scanning for arbitrage opportunities...");

    const tokenAddresses = Object.values(TOKENS);
    const flashloanTokens = [TOKENS.WETH, TOKENS.WBTC, TOKENS.USDCe];

    let promises = [];

    for (const flashloanToken of flashloanTokens) {
      for (const intermediateToken of tokenAddresses) {
        if (intermediateToken === flashloanToken) continue;

        for (const finalToken of tokenAddresses) {
          if (finalToken === flashloanToken || finalToken === intermediateToken) continue;

          promises.push(this._findBestArbitrageOpportunity(flashloanToken, intermediateToken, finalToken));
        }
      }
    }

    const allOpportunities = await Promise.all(promises);
    const opportunities = allOpportunities.filter(opp => opp !== null);

    // Sort opportunities by profit in descending order
    opportunities.sort((a, b) => {
      if (a.profit.gt(b.profit)) return -1;
      if (a.profit.lt(b.profit)) return 1;
      return 0;
    });

    console.log("📊 Top 5 Arbitrage Prospects:");
    opportunities.slice(0, 5).forEach((opportunity, index) => {
      const profitFormatted = ethers.utils.formatUnits(opportunity.profit, this._getTokenDecimals(opportunity.loanToken));
      const profitSign = opportunity.profit.gte(0) ? '✅' : '❌';
      console.log(`  ${index + 1}. ${profitSign} ${profitFormatted} ${this._getTokenSymbol(opportunity.loanToken)} (BPS: ${opportunity.profitInBPS}) - Path: ${this._getTokenSymbol(opportunity.loanToken)}->${this._getTokenSymbol(opportunity.intermediateToken)}->${this._getTokenSymbol(opportunity.finalToken)}->${this._getTokenSymbol(opportunity.loanToken)}`);
    });

    const bestOpportunity = opportunities[0];
    if (bestOpportunity && bestOpportunity.profit.gt(0) && bestOpportunity.profitInBPS > this.minBps) {
      console.log(`\n💎 EXECUTING PROFITABLE ARBITRAGE!`);
      console.log(`Profit: ${ethers.utils.formatUnits(bestOpportunity.profit, this._getTokenDecimals(bestOpportunity.loanToken))} ${this._getTokenSymbol(bestOpportunity.loanToken)} (${bestOpportunity.profitInBPS} BPS)`);

      await this.executor.executeFlashLoanArbitrage({
        loanToken: bestOpportunity.loanToken,
        tokenIn: bestOpportunity.firstTrade.tokenOut,
        amountIn: bestOpportunity.loanAmount,
        minMidOut: bestOpportunity.minMidOut,
        feeTier: 500, // Assuming a fee tier, needs to be dynamic based on pair
        routers: [bestOpportunity.firstTrade.dex.address, bestOpportunity.secondTrade.dex.address, bestOpportunity.thirdTrade.dex.address],
        path: [bestOpportunity.loanToken, bestOpportunity.firstTrade.tokenOut, bestOpportunity.secondTrade.tokenOut, bestOpportunity.thirdTrade.tokenOut]
      });

    } else {
      console.log(`❌ No profitable arbitrage opportunities found (min BPS: ${this.minBps})`);
    }

    console.log("=".repeat(80));
    console.log("\n");
  }

  async _findBestArbitrageOpportunity(flashloanToken, intermediateToken, finalToken) {
    const loanAmount = ethers.utils.parseUnits("1000", this._getTokenDecimals(flashloanToken));
    let bestFirstTrade = { amountOut: ethers.constants.Zero, dex: null };
    let bestSecondTrade = { amountOut: ethers.constants.Zero, dex: null };
    let bestThirdTrade = { amountOut: ethers.constants.Zero, dex: null };

    // Find best trade for first leg
    const firstTradePromises = Object.values(DEXES)
      .filter(dex => dex.type !== 'aggregator')
      .map(dex => this._getAmountsOut(dex, flashloanToken, intermediateToken, loanAmount)
        .then(amountOut => ({ amountOut, dex }))
        .catch(err => {
          console.warn(`  - First trade failed on ${dex.name} (${this._getTokenSymbol(flashloanToken)} -> ${this._getTokenSymbol(intermediateToken)}): ${err.message}`);
          return null;
        })
      );

    const firstTrades = (await Promise.all(firstTradePromises)).filter(Boolean);
    if (firstTrades.length > 0) {
      bestFirstTrade = firstTrades.reduce((best, current) => current.amountOut.gt(best.amountOut) ? current : best, bestFirstTrade);
    }
    if (!bestFirstTrade.dex) return null;

    // Find best trade for second leg
    const secondTradePromises = Object.values(DEXES)
      .filter(dex => dex.type !== 'aggregator')
      .map(dex => this._getAmountsOut(dex, intermediateToken, finalToken, bestFirstTrade.amountOut)
        .then(amountOut => ({ amountOut, dex }))
        .catch(err => {
          console.warn(`  - Second trade failed on ${dex.name} (${this._getTokenSymbol(intermediateToken)} -> ${this._getTokenSymbol(finalToken)}): ${err.message}`);
          return null;
        })
      );

    const secondTrades = (await Promise.all(secondTradePromises)).filter(Boolean);
    if (secondTrades.length > 0) {
      bestSecondTrade = secondTrades.reduce((best, current) => current.amountOut.gt(best.amountOut) ? current : best, bestSecondTrade);
    }
    if (!bestSecondTrade.dex) return null;

    // Find best trade for third leg
    const thirdTradePromises = Object.values(DEXES)
      .filter(dex => dex.type !== 'aggregator')
      .map(dex => this._getAmountsOut(dex, finalToken, flashloanToken, bestSecondTrade.amountOut)
        .then(amountOut => ({ amountOut, dex }))
        .catch(err => {
          console.warn(`  - Third trade failed on ${dex.name} (${this._getTokenSymbol(finalToken)} -> ${this._getTokenSymbol(flashloanToken)}): ${err.message}`);
          return null;
        })
      );

    const thirdTrades = (await Promise.all(thirdTradePromises)).filter(Boolean);
    if (thirdTrades.length > 0) {
      bestThirdTrade = thirdTrades.reduce((best, current) => current.amountOut.gt(best.amountOut) ? current : best, bestThirdTrade);
    }
    if (!bestThirdTrade.dex) return null;

    const profit = bestThirdTrade.amountOut.sub(loanAmount);
    const profitBps = this._calculateBPS(profit, loanAmount);

    return {
      loanToken: flashloanToken,
      intermediateToken: intermediateToken,
      finalToken: finalToken,
      loanAmount: loanAmount,
      firstTrade: { tokenOut: intermediateToken, dex: bestFirstTrade.dex },
      secondTrade: { tokenOut: finalToken, dex: bestSecondTrade.dex },
      thirdTrade: { tokenOut: flashloanToken, dex: bestThirdTrade.dex },
      minMidOut: bestFirstTrade.amountOut,
      profit: profit,
      profitInBPS: profitBps
    };
  }

  async _getAmountsOut(dex, tokenIn, tokenOut, amountIn) {
    switch (dex.type) {
      case "v2":
        const v2Router = new ethers.Contract(dex.address, IUniswapV2RouterABI, this.provider);
        const amountsOutV2 = await v2Router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
        return amountsOutV2[1];
      case "v3":
        const amountsOutV3 = await this.uniV3Quoter.callStatic.quoteExactInputSingle(
          tokenIn, tokenOut, 500, amountIn, 0
        );
        return amountsOutV3;
      case "balancer":
        throw new Error("Balancer price query not implemented");
      case "curve":
        const curveRouter = new ethers.Contract(dex.address, ICurveRouterABI, this.provider);
        const amountsOutCurve = await curveRouter.get_best_rate(tokenIn, tokenOut, amountIn);
        return amountsOutCurve.rate;
      case "aggregator":
        throw new Error("Aggregator price query requires off-chain API calls");
      default:
        throw new Error(`Unknown DEX type: ${dex.type}`);
    }
  }

  _calculateBPS(profit, amountIn) {
    if (amountIn.isZero()) return 0;
    const profitBps = profit.mul(10000).div(amountIn);
    return profitBps.toString();
  }

  _getTokenDecimals(address) {
    const decimalsMap = {
      [TOKENS.USDC]: 6,
      [TOKENS.USDCe]: 6,
      [TOKENS.USDT]: 6,
      [TOKENS.DAI]: 18,
      [TOKENS.WETH]: 18,
      [TOKENS.WBTC]: 8,
      [TOKENS.WMATIC]: 18,
    };
    return decimalsMap[address.toLowerCase()] || 18;
  }

  _getTokenSymbol(address) {
    const symbolMap = Object.keys(TOKENS).reduce((acc, key) => {
      acc[TOKENS[key].toLowerCase()] = key;
      return acc;
    }, {});
    return symbolMap[address.toLowerCase()] || address;
  }
}

module.exports = OpportunityScanner;
