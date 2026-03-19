# Scrapling Actor 入口 - 支持 python -m 运行
import asyncio
from scrapling_actor.main import main

if __name__ == '__main__':
    asyncio.run(main())
