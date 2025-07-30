import * as dotenv from 'dotenv';
dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY || '';
const QLOO_API_URL = process.env.QLOO_API_URL || 'https://hackathon.api.qloo.com';

describe('Bias Trends Parameter Issue', () => {
  it('should return different results for different entity combinations when bias.trends is removed', async () => {
    // Test case 1: Elmo + Pedro Pascal
    const response1 = await fetch(
      `${QLOO_API_URL}/v2/insights?signal.interests.entities=43033A6B-37BC-47F4-AF5D-6FF39F9281D7,B9727021-2C9B-4F8D-88FF-38C67BF8468B&filter.type=urn:entity:tv_show&take=3`,
      {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json',
        },
      }
    );
    const data1 = await response1.json() as any;
    const topResult1 = data1.results?.entities?.[0]?.name;

    // Test case 2: Elmo + Sesame Street
    const response2 = await fetch(
      `${QLOO_API_URL}/v2/insights?signal.interests.entities=43033A6B-37BC-47F4-AF5D-6FF39F9281D7,ED79C39E-CF54-4241-893D-8A0FADD7E84C&filter.type=urn:entity:tv_show&take=3`,
      {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json',
        },
      }
    );
    const data2 = await response2.json() as any;
    const topResult2 = data2.results?.entities?.[0]?.name;

    // Results should be different
    expect(topResult1).not.toBe(topResult2);
    expect(topResult1).not.toBe("Kevin Can F**k Himself");
    expect(topResult2).not.toBe("Kevin Can F**k Himself");
  });

  it('should return trending content when bias.trends=medium is used', async () => {
    // Test with bias.trends
    const response = await fetch(
      `${QLOO_API_URL}/v2/insights?signal.interests.entities=43033A6B-37BC-47F4-AF5D-6FF39F9281D7,B9727021-2C9B-4F8D-88FF-38C67BF8468B&filter.type=urn:entity:tv_show&take=3&bias.trends=medium`,
      {
        headers: {
          'X-Api-Key': QLOO_API_KEY,
          'Accept': 'application/json',
        },
      }
    );
    const data = await response.json() as any;
    const topResult = data.results?.entities?.[0]?.name;

    // With bias.trends, it often returns trending content like "Kevin Can F**k Himself"
    expect(topResult).toBeDefined();
  });
});