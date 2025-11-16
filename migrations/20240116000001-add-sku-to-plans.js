const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add SKU column to plans table
    await queryInterface.addColumn('plans', 'sku', {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      after: 'id',
    });

    // Add index for SKU
    await queryInterface.addIndex('plans', ['sku'], {
      name: 'idx_plans_sku',
      unique: true,
      where: {
        sku: {
          [Sequelize.Op.ne]: null,
        },
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('plans', 'idx_plans_sku');
    await queryInterface.removeColumn('plans', 'sku');
  },
};
