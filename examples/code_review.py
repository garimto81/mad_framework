"""Code review example using the CodeReviewPreset.

This example demonstrates multi-perspective code review.
"""

import asyncio

from mad import MAD
from mad.presets import CodeReviewPreset


async def main():
    """Run a code review debate."""
    # Use the code review preset
    preset = CodeReviewPreset()
    config = preset.to_config()

    # Create MAD with preset config
    mad = MAD(config)

    # Code to review
    code_to_review = '''
def process_user_data(request):
    """Process user data from request."""
    user_id = request.params.get("user_id")

    # Build SQL query
    query = f"SELECT * FROM users WHERE id = {user_id}"
    user = db.execute(query).fetchone()

    if user:
        # Process sensitive data
        password = user["password"]
        ssn = user["ssn"]

        # Log for debugging
        print(f"Processing user {user_id}: password={password}")

        # Cache user data
        cache[user_id] = {
            "password": password,
            "ssn": ssn,
            "processed_at": time.time()
        }

        return {"status": "success", "data": user}

    return {"status": "not_found"}
'''

    print("Starting code review...")
    print("=" * 60)
    print("Code to review:")
    print(code_to_review)
    print("=" * 60)

    # Run the review
    result = await mad.debate(
        topic="Review this Python function for issues and improvements",
        context=code_to_review,
    )

    # Print results
    print("\n" + "=" * 60)
    print("CODE REVIEW RESULTS")
    print("=" * 60)

    print(f"\nVerdict:\n{result.verdict}")
    print(f"\nConfidence: {result.confidence:.0%}")

    if result.consensus_points:
        print("\nAgreed Issues:")
        for i, point in enumerate(result.consensus_points, 1):
            print(f"  {i}. {point}")

    if result.recommendations:
        print(f"\nRecommendations:\n{result.recommendations}")

    print(f"\n{result.cost_summary}")


if __name__ == "__main__":
    asyncio.run(main())
