const puppeteer = require('puppeteer');

const sleep = seconds =>
  new Promise(resolve => setTimeout(resolve, (seconds || 1) * 1000))

const execute = async () => {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36');

  const findingAndFixingNumber = async(selector) => {
    const waitingNumber = await page.waitForSelector(selector, {
      timeout: 60000
    })
    .then(number => number.getProperty('innerText').then(numberInMillion => numberInMillion.jsonValue()))
    .catch(() => '-');

    if (waitingNumber === '-') {
      return '-';
    }
  
    const number = waitingNumber.slice(0, -2); // removing the " M", getting just the integer (Ex.: 3.078,19 M -> 3.078,19)

    let numberWithoutDotAndComma = '';
    for (let x = 0 ; x < number.length ; x++) {
      if (number[x] !== '.' && number[x] !== ',') {
        numberWithoutDotAndComma += number[x];
      }
    }
    // removing the comma and the dots, resulting in a number 100x greater (Ex.: 3.078,19 -> 307.819)

    return numberWithoutDotAndComma * 10000; // multiply by 1.000.000, because of the M of Million, and divide by 100, for taking out the comma
  }

  const sections = [
    '1/bens-industriais',
    '2/consumo-ciclico',
    '3/consumo-nao-ciclico',
    '4/financeiro-e-outros',
    '5/materiais-basicos',
    '6/petroleo-gas-e-biocombustiveis',
    '7/saude',
    '8/tecnologia-da-informacao',
    '9/comunicacoes',
    '10/utilidade-publica'
  ];
  const allTickers = [];

  for (let x = 0 ; x < sections.length ; x++) {
    await page.goto(`https://statusinvest.com.br/acoes/setor/${sections[x]}`);

    await page.select(`#main-2 > div > div > div.input-field.w-100.w-sm-50.w-md-15.pb-2.pr-sm-3 > div > select`, '1'); // to select the category "Ações"

    await page.select('#total-page-2', '-1'); // to select the category "TODOS"

    await sleep(3); // because of the delay that have in this transition

    const tickersSection = await page.$$eval('#companies > div.list.d-md-flex.flex-wrap.justify-between > div > div > div.info.w-100 > span > a', list => list.map(ticker => ticker.outerText));
    // get from this section all tickers from all stocks
    // .$$eval(selector) == Array.from(document.querySelectorAll(selector)) 

    const tickersWithRestrictions = tickersSection.reduce((total, ticker) => {
      if (total.length !== 0 && (ticker.slice(0, -1) === total[total.length - 1].slice(0, -1) || ticker.length > 5)) {
        // guarantee one ticker per stock and removes tickers with code greater than 9 
        return total;
      }

      total.push(ticker);
      return total;
    }, []);

    allTickers.push(...tickersWithRestrictions);
  }

  const tickerWithEvEbit = [];

  for (let y = 0 ; y < allTickers.length ; y++) {
    await page.goto(`https://statusinvest.com.br/acoes/${allTickers[y]}`);
    
    const waitingDailyLiquidity = await page.waitForSelector('#main-2 > div:nth-child(4) > div > div:nth-child(4) > div > div > div:nth-child(3) > div > div > div > strong', {
      timeout: 60000
    })
    .then(dailyLiquidity => dailyLiquidity.getProperty('innerText').then(liquidity => liquidity.jsonValue()))
    .catch(() => '-'); 

    const buttonOpenPeriod = await page.$('#contabil-section > div > div > div:nth-child(3) > header > div.d-flex.justify-between.flex-wrap.flex-md-nowrap.align-items-center > div.si-dropdown.dropdown-mode-grid.w-50.w-xs-30.w-md-auto > a');
    await buttonOpenPeriod.evaluate(button => button.click()); // to open the period selection

    await sleep(1); // just to guarantee
    
    const buttonSelectPeriod = await page.$('#dropdown-dre-grid > li:nth-child(2) > a');
    await buttonSelectPeriod.evaluate(button => button.click()); // select Trimestral

    await sleep(3); // just to guarantee

    const firstEbit = await findingAndFixingNumber('#contabil-section > div > div > div:nth-child(3) > div.scroll > div > table > tbody > tr:nth-child(7) > td:nth-child(11) > span');

    const secondEbit = await findingAndFixingNumber('#contabil-section > div > div > div:nth-child(3) > div.scroll > div.table-info-body.small > table > tbody > tr:nth-child(7) > td:nth-child(8) > span');

    const thirdEbit = await findingAndFixingNumber('#contabil-section > div > div > div:nth-child(3) > div.scroll > div.table-info-body.small > table > tbody > tr:nth-child(7) > td:nth-child(5) > span');

    const fourthEbit = await findingAndFixingNumber('#contabil-section > div > div > div:nth-child(3) > div.scroll > div.table-info-body.small > table > tbody > tr:nth-child(7) > td:nth-child(2) > span');

    const waitingEnterpriseValue = await page.waitForSelector('#company-section > div > div.top-info.info-3.sm.d-flex.justify-between.mb-5 > div:nth-child(8) > div > div > strong', {
      timeout: 60000
    })
    .then(enterpriseValue => enterpriseValue.getProperty('innerText').then(numberInMillion => numberInMillion.jsonValue()))
    .catch(() => '-');

    if (waitingDailyLiquidity !== '-' && waitingEnterpriseValue !== '-' && firstEbit !== '-'  && secondEbit !== '-'  && thirdEbit !== '-'  && fourthEbit !== '-') { 
    // removing stocks that don't 'exist' anymore or don't have any result
    
      let enterpriseValueWithoutDots = '';
      for (let x = 0 ; x < waitingEnterpriseValue.length ; x++) {
        if (waitingEnterpriseValue[x] !== '.') {
          enterpriseValueWithoutDots += waitingEnterpriseValue[x];
        }
      }
  
      const evEbit = Number((enterpriseValueWithoutDots / ((firstEbit + secondEbit + thirdEbit + fourthEbit) / 4)).toFixed(2));
      
      tickerWithEvEbit.push({
        ticker: allTickers[y],
        liquidity: waitingDailyLiquidity,
        evEbit
      });
    }
  }
  await browser.close();
  return tickerWithEvEbit
}

module.exports = {
  execute
}