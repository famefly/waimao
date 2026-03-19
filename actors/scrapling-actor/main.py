"""
Scrapling Actor - 自适应网页爬虫
基于 Scrapling 框架构建，支持反检测和自适应元素追踪
"""

from scrapling.fetchers import StealthyFetcher, DynamicFetcher
from scrapling.spiders import Spider, Response
import json
from typing import Optional, List, Dict, Any

# Apify SDK
from apify import Actor


async def scrape_with_stealth(url: str, selectors: Dict[str, str], wait_for: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    使用 StealthyFetcher 进行反检测爬取
    
    Args:
        url: 目标网址
        selectors: CSS 选择器字典，如 {'title': 'h1::text', 'email': 'a[href^="mailto:"]'}
        wait_for: 等待元素选择器
    """
    results = []
    
    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            network_idle=True,
            wait_for=wait_for
        )
        
        # 自动保存元素指纹，用于后续自适应匹配
        for name, selector in selectors.items():
            elements = page.css(selector, auto_save=True)
            for elem in elements:
                results.append({
                    'selector_name': name,
                    'value': elem.text_content() if hasattr(elem, 'text_content') else str(elem),
                    'url': url
                })
        
        # 提取邮箱
        email_elements = page.css('a[href^="mailto:"]')
        emails = [e.get_attribute('href').replace('mailto:', '') for e in email_elements if e.get_attribute('href')]
        
        # 提取电话
        phone_elements = page.css('a[href^="tel:"]')
        phones = [p.get_attribute('href').replace('tel:', '') for p in phone_elements if p.get_attribute('href')]
        
        # 提取所有链接
        links = page.css('a::attr(href)')
        
        return {
            'url': url,
            'results': results,
            'emails': list(set(emails)),
            'phones': list(set(phones)),
            'links': [l for l in links if l and l.startswith('http')][:50],  # 限制50个链接
            'success': True
        }
        
    except Exception as e:
        return {
            'url': url,
            'error': str(e),
            'success': False
        }


async def scrape_business_directory(
    start_url: str,
    item_selector: str,
    fields: Dict[str, str],
    max_pages: int = 10,
    next_page_selector: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    爬取商业目录网站
    
    Args:
        start_url: 起始URL
        item_selector: 每个商家条目的选择器
        fields: 字段映射，如 {'company': 'h3::text', 'phone': '.phone::text'}
        max_pages: 最大页数
        next_page_selector: 下一页按钮选择器
    """
    all_items = []
    current_url = start_url
    
    for page_num in range(max_pages):
        try:
            page = StealthyFetcher.fetch(current_url, headless=True, network_idle=True)
            
            # 提取所有商家条目
            items = page.css(item_selector, auto_save=True)
            
            for item in items:
                business_data = {}
                for field_name, selector in fields.items():
                    elem = item.css(selector)
                    if elem:
                        business_data[field_name] = elem[0].text_content().strip() if hasattr(elem[0], 'text_content') else str(elem[0])
                    else:
                        business_data[field_name] = ''
                
                # 自动提取邮箱和电话
                email_elem = item.css('a[href^="mailto:"]')
                if email_elem:
                    business_data['email'] = email_elem[0].get_attribute('href').replace('mailto:', '')
                
                phone_elem = item.css('a[href^="tel:"]')
                if phone_elem:
                    business_data['phone'] = phone_elem[0].get_attribute('href').replace('tel:', '')
                
                if business_data.get('company') or business_data.get('name'):
                    all_items.append(business_data)
            
            # 查找下一页
            if next_page_selector:
                next_page = page.css(next_page_selector + '::attr(href)')
                if next_page and next_page[0]:
                    current_url = next_page[0]
                else:
                    break
            else:
                break
                
        except Exception as e:
            print(f"Error on page {page_num}: {e}")
            break
    
    return all_items


async def main():
    """Apify Actor 入口"""
    async with Actor:
        # 获取输入参数
        input_data = await Actor.get_input()
        
        mode = input_data.get('mode', 'single')  # single, directory, search
        urls = input_data.get('urls', [])
        selectors = input_data.get('selectors', {})
        
        results = []
        
        if mode == 'single':
            # 单页面爬取
            for url in urls:
                result = await scrape_with_stealth(url, selectors)
                results.append(result)
                
        elif mode == 'directory':
            # 商业目录爬取
            start_url = input_data.get('startUrl', urls[0] if urls else '')
            item_selector = input_data.get('itemSelector', '.business-item')
            fields = input_data.get('fields', {'company': 'h3::text', 'address': '.address::text'})
            max_pages = input_data.get('maxPages', 10)
            next_page_selector = input_data.get('nextPageSelector')
            
            items = await scrape_business_directory(
                start_url, item_selector, fields, max_pages, next_page_selector
            )
            results = items
        
        # 保存结果
        await Actor.push_data(results)
        
        return results


if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
