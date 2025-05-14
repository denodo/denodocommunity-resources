package com.denodo.springbatchkb.entity;

import java.math.BigDecimal;
import java.sql.Timestamp;

public class MyWriteEntityPOJO {
    private int id;
    private String string_col_1;
    private BigDecimal numeric_col_1;
    private BigDecimal numeric_col_2;
    private BigDecimal total;
    private Timestamp timestamp_column;

    public MyWriteEntityPOJO(int id, String string_col_1, BigDecimal numeric_col_1, BigDecimal numeric_col_2, BigDecimal total, Timestamp timestamp_column) {
        this.id = id;
        this.string_col_1 = string_col_1;
        this.numeric_col_1 = numeric_col_1;
        this.numeric_col_2 = numeric_col_2;
        this.total = total;
        this.timestamp_column = timestamp_column;
    }

    public MyWriteEntityPOJO(MyReadEntityPOJO readEntity, BigDecimal total) {
        this.id = readEntity.getId();
        this.string_col_1 = readEntity.getString_col_1();
        this.numeric_col_1 = readEntity.getNumeric_col_1();
        this.numeric_col_2 = readEntity.getNumeric_col_2();
        this.timestamp_column = readEntity.getTimestamp_column();
        this.total = total;
    }

    // Getters and Setters

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getString_col_1() {
        return string_col_1;
    }

    public void setString_col_1(String string_col_1) {
        this.string_col_1 = string_col_1;
    }

    public BigDecimal getNumeric_col_1() {
        return numeric_col_1;
    }

    public void setNumeric_col_1(BigDecimal numeric_col_1) {
        this.numeric_col_1 = numeric_col_1;
    }

    public BigDecimal getNumeric_col_2() {
        return numeric_col_2;
    }

    public void setNumeric_col_2(BigDecimal numeric_col_2) {
        this.numeric_col_2 = numeric_col_2;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public void setTotal(BigDecimal total) {
        this.total = total;
    }

    public Timestamp getTimestamp_column() {
        return timestamp_column;
    }

    public void setTimestamp_column(Timestamp timestamp_column) {
        this.timestamp_column = timestamp_column;
    }
}
