const daimoConfig = jest.genMockFromModule('../../../src/config/daimo');

daimoConfig.createDaimoPayment = jest.fn().mockResolvedValue({
  success: true,
  paymentUrl: 'https://mock.daimo.com/pay/123',
  daimoPaymentId: 'daimo-123',
});

module.exports = daimoConfig;
