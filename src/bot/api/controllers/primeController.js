exports.getLatestPrimeVideo = (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'The Future of AI',
      thumbnailUrl: 'https://via.placeholder.com/300x150.png?text=Prime+Video',
      link: '/videorama/prime-123',
    },
  });
};
