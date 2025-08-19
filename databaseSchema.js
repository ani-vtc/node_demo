// Database schema configuration for SQL generation
// This provides table structure information without requiring database connection

export const databaseSchema = {
  schools: {
    table_name: "schools",
    columns: [
      { name: "school_id", type: "INT", primary_key: true },
      { name: "school_name", type: "VARCHAR(255)" },
      { name: "school_type", type: "VARCHAR(100)" },
      { name: "district", type: "VARCHAR(255)" },
      { name: "address", type: "TEXT" },
      { name: "phone", type: "VARCHAR(20)" },
      { name: "email", type: "VARCHAR(255)" },
      { name: "website", type: "VARCHAR(255)" },
      { name: "principal", type: "VARCHAR(255)" },
      { name: "enrollment_capacity", type: "INT" },
      { name: "grade_levels", type: "VARCHAR(50)" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  students: {
    table_name: "students", 
    columns: [
      { name: "student_id", type: "INT", primary_key: true },
      { name: "first_name", type: "VARCHAR(100)" },
      { name: "last_name", type: "VARCHAR(100)" },
      { name: "date_of_birth", type: "DATE" },
      { name: "grade_level", type: "INT" },
      { name: "gender", type: "CHAR(1)" },
      { name: "address", type: "TEXT" },
      { name: "parent_phone", type: "VARCHAR(20)" },
      { name: "parent_email", type: "VARCHAR(255)" },
      { name: "emergency_contact", type: "VARCHAR(255)" },
      { name: "medical_conditions", type: "TEXT" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  enrollments: {
    table_name: "enrollments",
    columns: [
      { name: "enrollment_id", type: "INT", primary_key: true },
      { name: "student_id", type: "INT", foreign_key: "students.student_id" },
      { name: "school_id", type: "INT", foreign_key: "schools.school_id" },
      { name: "enrollment_date", type: "DATE" },
      { name: "graduation_date", type: "DATE" },
      { name: "status", type: "ENUM('active', 'graduated', 'transferred', 'dropped')" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  teachers: {
    table_name: "teachers",
    columns: [
      { name: "teacher_id", type: "INT", primary_key: true },
      { name: "first_name", type: "VARCHAR(100)" },
      { name: "last_name", type: "VARCHAR(100)" },
      { name: "email", type: "VARCHAR(255)" },
      { name: "phone", type: "VARCHAR(20)" },
      { name: "subject", type: "VARCHAR(100)" },
      { name: "hire_date", type: "DATE" },
      { name: "salary", type: "DECIMAL(10,2)" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  classes: {
    table_name: "classes",
    columns: [
      { name: "class_id", type: "INT", primary_key: true },
      { name: "class_name", type: "VARCHAR(255)" },
      { name: "school_id", type: "INT", foreign_key: "schools.school_id" },
      { name: "teacher_id", type: "INT", foreign_key: "teachers.teacher_id" },
      { name: "subject", type: "VARCHAR(100)" },
      { name: "grade_level", type: "INT" },
      { name: "capacity", type: "INT" },
      { name: "schedule", type: "VARCHAR(255)" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  catchments: {
    table_name: "catchments",
    columns: [
      { name: "catchment_id", type: "INT", primary_key: true },
      { name: "school_id", type: "INT", foreign_key: "schools.school_id" },
      { name: "area_name", type: "VARCHAR(255)" },
      { name: "geometry", type: "GEOMETRY" },
      { name: "population", type: "INT" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  }
};

// Helper function to get schema as formatted string for LLM
export function getSchemaContext() {
  const tables = Object.values(databaseSchema);
  return tables.map(table => {
    const columns = table.columns.map(col => {
      let colDef = `${col.name} (${col.type})`;
      if (col.primary_key) colDef += ' PRIMARY KEY';
      if (col.foreign_key) colDef += ` REFERENCES ${col.foreign_key}`;
      return colDef;
    }).join('\n    ');
    
    return `${table.table_name}:\n    ${columns}`;
  }).join('\n\n');
}

// Helper function to get available table names
export function getTableNames() {
  return Object.keys(databaseSchema);
}