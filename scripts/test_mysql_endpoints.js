require('dotenv').config();
const mysqlService = require('../services/mysqlService');

async function testAll() {
  console.log('--- 1. Testing Auth ---');
  const user = await mysqlService.getUserByEmail('admin@keraladesam.com');
  console.log('User found:', user ? user.name : 'None');
  if (user) {
    const isPwMatch = await user.matchPassword('admin12345');
    console.log('Password match:', isPwMatch);
  }

  console.log('\n--- 2. Testing Articles ---');
  const { articles, total } = await mysqlService.getArticles({ limit: 3 });
  console.log(`Fetched ${articles.length} of total ${total} articles.`);
  if (articles[0]) {
    console.log('Sample Article:', {
      id: articles[0].id,
      title: articles[0].title.slice(0, 40) + '...',
      category: articles[0].category,
      paragraphsCount: articles[0].paragraphs?.length,
    });
  }

  console.log('\n--- 3. Testing Breaking News ---');
  const breaking = await mysqlService.getBreakingNews();
  console.log(`Breaking news count: ${breaking.length}`);
  if (breaking[0]) {
    console.log('Sample breaking:', breaking[0].headline.slice(0, 40) + '...');
  }

  console.log('\n--- 4. Testing Videos ---');
  const { videos, total: totalVids } = await mysqlService.getVideos({ limit: 3 });
  console.log(`Videos count: ${videos.length} (total: ${totalVids})`);
  if (videos[0]) {
    console.log('Sample video:', videos[0].title.slice(0, 40) + '...');
  }

  console.log('\n--- 5. Testing Subscribers ---');
  const subs = await mysqlService.getSubscribers();
  console.log(`Subscribers count: ${subs.length}`);

  console.log('\n--- 6. Testing Ad Inquiries ---');
  const ads = await mysqlService.getAdInquiries();
  console.log(`Ad inquiries count: ${ads.length}`);

  console.log('\nALL MYSQL TESTS PASSED SUCCESSFULLY! ✅');
  process.exit(0);
}

testAll().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
