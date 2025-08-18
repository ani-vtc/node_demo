export class SQLValidator {
  constructor() {
    this.dangerousPatterns = [
      /;\s*drop\s+/i,
      /;\s*delete\s+/i,
      /;\s*update\s+/i,
      /;\s*insert\s+/i,
      /;\s*create\s+/i,
      /;\s*alter\s+/i,
      /;\s*truncate\s+/i,
      /union\s+select/i,
      /--\s*$/,
      /\/\*[\s\S]*?\*\//,
      /xp_cmdshell/i,
      /sp_executesql/i,
      /exec\s*\(/i,
      /execute\s*\(/i,
      /';\s*exec/i,
      /';\s*execute/i,
      /load_file\s*\(/i,
      /into\s+outfile/i,
      /into\s+dumpfile/i,
      /benchmark\s*\(/i,
      /sleep\s*\(/i,
      /pg_sleep\s*\(/i,
      /waitfor\s+delay/i,
      /information_schema/i,
      /mysql\.user/i,
      /pg_user/i,
      /sysobjects/i,
      /syscolumns/i,
      /msysaces/i,
      /msysqueries/i,
      /admin\s*'/i,
      /1=1/,
      /'or'1'='1/i,
      /"or"1"="1/i,
      /'\s+or\s+'/i,
      /"\s+or\s+"/i,
      /concat\s*\(/i,
      /group_concat\s*\(/i,
      /@@version/i,
      /@@hostname/i,
      /user\s*\(\)/i,
      /database\s*\(\)/i,
      /version\s*\(\)/i,
      /current_user/i,
      /current_database/i,
      /getdate\s*\(\)/i,
      /rand\s*\(\)/i
    ];

    this.allowedKeywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'FULL JOIN', 'ON', 'AS', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT',
      'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'AND', 'OR', 'NOT',
      'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'DESC', 'ASC', 'CASE', 'WHEN',
      'THEN', 'ELSE', 'END', 'IF', 'IFNULL', 'COALESCE', 'CONCAT', 'SUBSTRING',
      'LENGTH', 'UPPER', 'LOWER', 'TRIM', 'CAST', 'CONVERT', 'DATE', 'TIME',
      'DATETIME', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND',
      'DATE_FORMAT', 'STR_TO_DATE', 'NOW', 'CURDATE', 'CURTIME'
    ];
  }

  validateSQL(query) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!query || typeof query !== 'string') {
      validation.isValid = false;
      validation.errors.push('Query must be a non-empty string');
      return validation;
    }

    const cleanQuery = query.trim();
    
    if (cleanQuery.length === 0) {
      validation.isValid = false;
      validation.errors.push('Query cannot be empty');
      return validation;
    }

    if (!cleanQuery.toLowerCase().startsWith('select')) {
      validation.isValid = false;
      validation.errors.push('Only SELECT queries are allowed');
      return validation;
    }

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(cleanQuery)) {
        validation.isValid = false;
        validation.errors.push(`Potentially dangerous SQL pattern detected: ${pattern.source}`);
      }
    }

    const semicolonCount = (cleanQuery.match(/;/g) || []).length;
    if (semicolonCount > 1) {
      validation.isValid = false;
      validation.errors.push('Multiple statements not allowed');
    } else if (semicolonCount === 1 && !cleanQuery.endsWith(';')) {
      validation.isValid = false;
      validation.errors.push('Semicolon must only appear at the end of the query');
    }

    const quoteCounts = {
      single: (cleanQuery.match(/'/g) || []).length,
      double: (cleanQuery.match(/"/g) || []).length,
      backtick: (cleanQuery.match(/`/g) || []).length
    };

    if (quoteCounts.single % 2 !== 0) {
      validation.isValid = false;
      validation.errors.push('Unmatched single quotes detected');
    }

    if (quoteCounts.double % 2 !== 0) {
      validation.isValid = false;
      validation.errors.push('Unmatched double quotes detected');
    }

    if (quoteCounts.backtick % 2 !== 0) {
      validation.isValid = false;
      validation.errors.push('Unmatched backticks detected');
    }

    const parenthesesCount = {
      open: (cleanQuery.match(/\(/g) || []).length,
      close: (cleanQuery.match(/\)/g) || []).length
    };

    if (parenthesesCount.open !== parenthesesCount.close) {
      validation.isValid = false;
      validation.errors.push('Unmatched parentheses detected');
    }

    if (cleanQuery.length > 10000) {
      validation.warnings.push('Query is very long and may impact performance');
    }

    const nestedSubqueries = (cleanQuery.match(/\(\s*select/gi) || []).length;
    if (nestedSubqueries > 3) {
      validation.warnings.push('Query has many nested subqueries which may impact performance');
    }

    return validation;
  }

  sanitizeQuery(query) {
    if (!query || typeof query !== 'string') {
      return '';
    }

    let sanitized = query.trim();
    
    sanitized = sanitized.replace(/--.*$/gm, '');
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');
    
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    if (!sanitized.endsWith(';')) {
      sanitized += ';';
    }

    return sanitized;
  }

  formatQuery(query) {
    if (!query || typeof query !== 'string') {
      return '';
    }

    let formatted = query.trim();
    
    const keywords = this.allowedKeywords.join('|');
    const keywordRegex = new RegExp(`\\b(${keywords})\\b`, 'gi');
    
    formatted = formatted.replace(keywordRegex, (match) => match.toUpperCase());
    
    formatted = formatted.replace(/\s*,\s*/g, ', ');
    formatted = formatted.replace(/\s*=\s*/g, ' = ');
    formatted = formatted.replace(/\s*<\s*/g, ' < ');
    formatted = formatted.replace(/\s*>\s*/g, ' > ');
    formatted = formatted.replace(/\s*<=\s*/g, ' <= ');
    formatted = formatted.replace(/\s*>=\s*/g, ' >= ');
    formatted = formatted.replace(/\s*<>\s*/g, ' <> ');
    formatted = formatted.replace(/\s*!=\s*/g, ' != ');
    
    formatted = formatted.replace(/\s+/g, ' ');

    return formatted;
  }
}