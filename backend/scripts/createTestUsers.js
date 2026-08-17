// 创建测试账号脚本
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sequelize } = require('../src/config/database');
const { User, Product, Order, Review } = require('../src/models');
const bcrypt = require('bcryptjs');

async function createTestUsers() {
  try {
    console.log('=== 创建测试账号 ===\n');

    const testUsers = [
      { username: 'zhangsan', password: 'Test1234', email: 'zhangsan@univ.edu.cn', student_id: '2021001234', nickname: '张三', role: 2 },
      { username: 'lisi', password: 'Test1234', email: 'lisi@univ.edu.cn', student_id: '2021001235', nickname: '李四', role: 2 },
      { username: 'wangwu', password: 'Test1234', email: 'wangwu@univ.edu.cn', student_id: '2021001236', nickname: '王五', role: 2 },
    ];

    const created = [];
    for (const u of testUsers) {
      const existing = await User.findOne({ where: { username: u.username } });
      if (existing) {
        console.log(`  [跳过] ${u.username} 已存在 (ID=${existing.id})`);
        created.push(existing);
        continue;
      }
      const hashed = await bcrypt.hash(u.password, 10);
      const user = await User.create({
        ...u,
        password: hashed,
        status: 1,
        campus_verified: 1,
      });
      console.log(`  [创建] ${u.username} / ${u.password} (ID=${user.id}, ${u.nickname})`);
      created.push(user);
    }

    // 为张三创建一个已审核通过的商品
    console.log('\n=== 为张三创建测试商品 ===');
    const zhangsan = created[0];
    const existingProduct = await Product.findOne({ where: { user_id: zhangsan.id } });
    if (!existingProduct) {
      const product = await Product.create({
        user_id: zhangsan.id,
        category_id: 1,
        title: '高等数学第七版 - 几乎全新',
        description: '上课用了一学期,笔记很少,书页完好。适合大一新生。',
        price: 25.00,
        original_price: 49.80,
        condition_level: 4,
        trade_type: 1,
        status: 1,
        view_count: 15,
        favorite_count: 3,
      });
      console.log(`  [创建] 商品: ${product.title} (ID=${product.id})`);

      const product2 = await Product.create({
        user_id: zhangsan.id,
        category_id: 3,
        title: '宿舍收纳盒三件套',
        description: '毕业出闲置,收纳盒三件套,质量很好,原价50多。',
        price: 15.00,
        original_price: 55.00,
        condition_level: 3,
        trade_type: 1,
        status: 1,
        view_count: 8,
        favorite_count: 1,
      });
      console.log(`  [创建] 商品: ${product2.title} (ID=${product2.id})`);
    } else {
      console.log('  [跳过] 张三已有商品');
    }

    // 为李四创建一个商品
    const lisi = created[1];
    const lisiProduct = await Product.findOne({ where: { user_id: lisi.id } });
    if (!lisiProduct) {
      const product3 = await Product.create({
        user_id: lisi.id,
        category_id: 2,
        title: '罗技无线鼠标 - 九成新',
        description: '用了半年,功能完好,电池续航持久。带接收器。',
        price: 45.00,
        original_price: 99.00,
        condition_level: 3,
        trade_type: 2,
        status: 1,
        view_count: 22,
        favorite_count: 5,
      });
      console.log(`  [创建] 商品: ${product3.title} (ID=${product3.id})`);
    }

    // 创建一个订单: 王五(买家) 购买 张三的商品
    console.log('\n=== 创建测试订单 ===');
    const wangwu = created[2];
    const zhangsanProduct = await Product.findOne({ where: { user_id: zhangsan.id, status: 1 } });
    if (zhangsanProduct) {
      const existingOrder = await Order.findOne({ where: { product_id: zhangsanProduct.id } });
      if (!existingOrder) {
        const order = await Order.create({
          order_no: 'TEST' + Date.now(),
          product_id: zhangsanProduct.id,
          seller_id: zhangsan.id,
          buyer_id: wangwu.id,
          price: zhangsanProduct.price,
          trade_type: 1,
          product_title: zhangsanProduct.title,
          status: 3, // 已完成
          buyer_confirmed: 1,
          seller_confirmed: 1,
          confirmed_at: new Date(),
          remark: '测试订单',
        });
        console.log(`  [创建] 订单 #${order.id}: ${wangwu.nickname} 购买 "${zhangsanProduct.title}"`);

        // 创建评价
        const existingReview = await Review.findOne({ where: { order_id: order.id } });
        if (!existingReview) {
          const review = await Review.create({
            order_id: order.id,
            product_id: zhangsanProduct.id,
            from_user_id: wangwu.id,
            to_user_id: zhangsan.id,
            reviewer_role: 1, // 买家评价卖家
            rating: 5,
            content: '书很新,发货快,好评!',
          });
          console.log(`  [创建] 评价: 5星 - ${review.content}`);
        }
      }
    }

    console.log('\n=== 测试账号汇总 ===');
    console.log('┌──────────┬──────────┬──────────────┬────────────────┐');
    console.log('│ 用户名   │ 密码     │ 角色         │ 邮箱           │');
    console.log('├──────────┼──────────┼──────────────┼────────────────┤');
    console.log('│ admin    │ admin123 │ 管理员       │ admin@univ.edu │');
    console.log('│ zhangsan │ Test1234 │ 用户(卖家)   │ zhangsan@...   │');
    console.log('│ lisi     │ Test1234 │ 用户(卖家)   │ lisi@...       │');
    console.log('│ wangwu   │ Test1234 │ 用户(买家)   │ wangwu@...     │');
    console.log('└──────────┴──────────┴──────────────┴────────────────┘');

    console.log('\n测试数据创建完成!');
  } catch (err) {
    console.error('创建失败:', err.message);
  } finally {
    await sequelize.close();
  }
}

createTestUsers();
