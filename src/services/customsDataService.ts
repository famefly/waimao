/**
 * 海关数据服务
 * 集成多个海关数据 API 提供商
 * 
 * 支持的数据源：
 * 1. Tendata（特易）- https://www.tendata.cn/ - 国内推荐，性价比高
 * 2. Export Genius - https://www.exportgenius.in/
 * 3. Descartes - https://www.descartes.com/
 * 
 * 注意：这些服务通常需要付费订阅
 */

import { getSupabase } from '../lib/supabase';

// 海关数据 API 配置接口
interface CustomsApiConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
}

// 海关数据查询参数
interface CustomsQueryParams {
  keyword?: string;
  hsCode?: string;
  country?: string;
  importerName?: string;
  exporterName?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

// 海关记录结构
interface CustomsRecord {
  id: string;
  importerName: string;
  importerAddress?: string;
  importerCountry?: string;
  importerContact?: string;
  importerEmail?: string;
  importerPhone?: string;
  exporterName: string;
  exporterAddress?: string;
  exporterCountry?: string;
  hsCode: string;
  hsCodeDescription: string;
  productDescription: string;
  quantity?: number;
  quantityUnit?: string;
  value?: number;
  currency?: string;
  shipmentDate?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  shippingLine?: string;
  containerNumber?: string;
  weight?: number;
  weightUnit?: string;
}

// 获取海关数据 API 配置
export const getCustomsApiConfig = async (): Promise<CustomsApiConfig | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data } = await supabase
      .from('api_configs')
      .select('key_name, key_value')
      .in('key_name', ['customs_api_provider', 'customs_api_key', 'customs_api_url']);

    if (!data || data.length < 2) return null;

    const configMap = Object.fromEntries(
      data.map((item: any) => [item.key_name, item.key_value])
    );

    return {
      provider: configMap.customs_api_provider || 'tendata',
      apiKey: configMap.customs_api_key || '',
      baseUrl: configMap.customs_api_url || 'https://api.tendata.cn/v1',
    };
  } catch (error) {
    console.error('获取海关数据配置失败:', error);
    return null;
  }
};

/**
 * Tendata（特易）API 查询
 * 官网: https://www.tendata.cn/
 * 国内领先的海关数据服务商，性价比高
 */
export const queryTendata = async (
  params: CustomsQueryParams,
  config: CustomsApiConfig
): Promise<CustomsRecord[]> => {
  const requestBody = {
    keyword: params.keyword,
    hs_code: params.hsCode,
    country: params.country,
    importer: params.importerName,
    exporter: params.exporterName,
    start_date: params.dateFrom,
    end_date: params.dateTo,
    page_size: params.limit || 100,
    page: 1,
  };

  try {
    const response = await fetch(
      `${config.baseUrl}/trade/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Tendata API 错误: ${response.status}`);
    }

    const data = await response.json() as { data: any[]; total: number };
    
    return data.data.map((item: any) => ({
      id: item.id || `td-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      importerName: item.importer_name || item.buyer || item.采购商 || '',
      importerAddress: item.importer_address || item.buyer_address || '',
      importerCountry: item.importer_country || item.buyer_country || '',
      importerContact: item.importer_contact || item.contact_person || '',
      importerEmail: item.importer_email || item.email || '',
      importerPhone: item.importer_phone || item.phone || '',
      exporterName: item.exporter_name || item.seller || item.供应商 || '',
      exporterAddress: item.exporter_address || item.seller_address || '',
      exporterCountry: item.exporter_country || item.seller_country || '',
      hsCode: item.hs_code || item.hscode || '',
      hsCodeDescription: item.hs_description || item.goods_description || '',
      productDescription: item.product_description || item.product_name || item.产品描述 || '',
      quantity: item.quantity || item.qty,
      quantityUnit: item.unit || item.quantity_unit,
      value: item.value || item.usd_value || item.total_value,
      currency: item.currency || 'USD',
      shipmentDate: item.shipment_date || item.date || item.日期,
      portOfLoading: item.pol || item.port_of_loading || item.起运港,
      portOfDischarge: item.pod || item.port_of_discharge || item.目的港,
      shippingLine: item.shipping_line || item.carrier || '',
      containerNumber: item.container_number || '',
      weight: item.weight || item.gross_weight,
      weightUnit: item.weight_unit || 'KG',
    }));
  } catch (error) {
    console.error('Tendata 查询失败:', error);
    throw error;
  }
};

/**
 * Export Genius API 查询
 * 文档: https://www.exportgenius.in/api-docs
 */
export const queryExportGenius = async (
  params: CustomsQueryParams,
  config: CustomsApiConfig
): Promise<CustomsRecord[]> => {
  const queryParams = new URLSearchParams();
  
  if (params.keyword) queryParams.append('q', params.keyword);
  if (params.hsCode) queryParams.append('hs_code', params.hsCode);
  if (params.country) queryParams.append('country', params.country);
  if (params.importerName) queryParams.append('importer', params.importerName);
  if (params.dateFrom) queryParams.append('date_from', params.dateFrom);
  if (params.dateTo) queryParams.append('date_to', params.dateTo);
  queryParams.append('limit', String(params.limit || 100));

  try {
    const response = await fetch(
      `${config.baseUrl}/search?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Export Genius API 错误: ${response.status}`);
    }

    const data = await response.json() as { data: any[] };
    
    return data.data.map((item: any) => ({
      id: item.id || `eg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      importerName: item.importer_name || item.importer || '',
      importerAddress: item.importer_address || '',
      importerCountry: item.importer_country || '',
      exporterName: item.exporter_name || item.exporter || '',
      exporterAddress: item.exporter_address || '',
      exporterCountry: item.exporter_country || '',
      hsCode: item.hs_code || '',
      hsCodeDescription: item.hs_description || '',
      productDescription: item.product_description || item.goods_description || '',
      quantity: item.quantity || item.qty,
      quantityUnit: item.unit || item.quantity_unit,
      value: item.value || item.usd_value,
      currency: item.currency || 'USD',
      shipmentDate: item.shipment_date || item.date,
      portOfLoading: item.pol || item.port_of_loading,
      portOfDischarge: item.pod || item.port_of_discharge,
      shippingLine: item.shipping_line || '',
      containerNumber: item.container_number || '',
      weight: item.weight || item.gross_weight,
      weightUnit: item.weight_unit || 'KG',
    }));
  } catch (error) {
    console.error('Export Genius 查询失败:', error);
    throw error;
  }
};

/**
 * Descartes Datamyne API 查询
 * 文档: https://www.descartes.com/solutions/global-trade-intelligence
 */
export const queryDescartes = async (
  params: CustomsQueryParams,
  config: CustomsApiConfig
): Promise<CustomsRecord[]> => {
  const requestBody = {
    searchCriteria: {
      keywords: params.keyword,
      hsCodes: params.hsCode ? [params.hsCode] : undefined,
      countries: params.country ? [params.country] : undefined,
      importerName: params.importerName,
      exporterName: params.exporterName,
      dateRange: params.dateFrom && params.dateTo 
        ? { from: params.dateFrom, to: params.dateTo }
        : undefined,
    },
    pagination: {
      limit: params.limit || 100,
      offset: 0,
    },
  };

  try {
    const response = await fetch(
      `${config.baseUrl}/trade-data/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Descartes API 错误: ${response.status}`);
    }

    const data = await response.json() as { records: any[] };
    
    return data.records.map((item: any) => ({
      id: item.id || `desc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      importerName: item.importer?.name || '',
      importerAddress: item.importer?.address || '',
      importerCountry: item.importer?.country || '',
      exporterName: item.exporter?.name || '',
      exporterAddress: item.exporter?.address || '',
      exporterCountry: item.exporter?.country || '',
      hsCode: item.tariff?.hsCode || '',
      hsCodeDescription: item.tariff?.description || '',
      productDescription: item.goods?.description || '',
      quantity: item.goods?.quantity,
      quantityUnit: item.goods?.unit,
      value: item.financial?.value,
      currency: item.financial?.currency || 'USD',
      shipmentDate: item.shipment?.date,
      portOfLoading: item.shipment?.portOfLoading,
      portOfDischarge: item.shipment?.portOfDischarge,
      shippingLine: item.shipment?.carrier,
      containerNumber: item.container?.number,
      weight: item.goods?.weight,
      weightUnit: item.goods?.weightUnit || 'KG',
    }));
  } catch (error) {
    console.error('Descartes 查询失败:', error);
    throw error;
  }
};

/**
 * 通用海关数据查询入口
 * 根据配置的提供商自动选择 API
 */
export const queryCustomsData = async (
  params: CustomsQueryParams
): Promise<CustomsRecord[]> => {
  const config = await getCustomsApiConfig();
  
  if (!config || !config.apiKey) {
    throw new Error('海关数据 API 未配置，请先在系统设置中配置 API Key');
  }

  switch (config.provider.toLowerCase()) {
    case 'tendata':
    case '特易':
      return queryTendata(params, config);
    
    case 'exportgenius':
    case 'export_genius':
      return queryExportGenius(params, config);
    
    case 'descartes':
    case 'descartes_datamyne':
      return queryDescartes(params, config);
    
    default:
      throw new Error(`不支持的海关数据提供商: ${config.provider}`);
  }
};

/**
 * 将海关记录转换为客户数据格式
 */
export const convertCustomsRecordToCustomer = (
  record: CustomsRecord,
  departmentId: string | null
) => {
  return {
    company_name: record.importerName,
    country: record.importerCountry ? [record.importerCountry] : null,
    industry: record.hsCodeDescription?.split(' ')[0] || '',
    main_products: record.productDescription || record.hsCodeDescription || '',
    contact_email: record.importerEmail || '',
    contact_phone: record.importerPhone || '',
    contact_name: record.importerContact || '',
    source_platform: 'customs_data',
    source_url: '',
    channel_type: 'trading_company',
    department_id: departmentId,
    status: 'pending',
    email_verified: false,
    annual_purchase: record.value ? `${record.value} ${record.currency}` : '',
    raw_data: JSON.stringify(record),
  };
};

/**
 * 批量导入海关数据为客户
 */
export const importCustomsDataAsCustomers = async (
  params: CustomsQueryParams,
  departmentId: string | null
): Promise<{ total: number; imported: number }> => {
  const records = await queryCustomsData(params);
  const supabase = getSupabase();
  
  if (!supabase) {
    throw new Error('数据库未连接');
  }

  let imported = 0;
  
  for (const record of records) {
    if (!record.importerName) continue;
    
    const customerData = convertCustomsRecordToCustomer(record, departmentId);
    
    try {
      const { error } = await supabase
        .from('customers')
        .insert(customerData);
      
      if (!error) {
        imported++;
      }
    } catch (e) {
      // 忽略重复数据
    }
  }

  return {
    total: records.length,
    imported,
  };
};