package com.denodo.springbatchkb.entity;

import java.math.BigDecimal;
import java.sql.Timestamp;

public class MyReadEntityAnalyticalPOJO {
    private int id;

    private BigDecimal numeric_col_1;

    private Timestamp timestamp_column;

    public MyReadEntityAnalyticalPOJO(int id, BigDecimal numeric_col_1, Timestamp timestamp_column, BigDecimal rownum) {
        this.id = id;
        this.numeric_col_1 = numeric_col_1;
        this.timestamp_column = timestamp_column;
        this.rownum = rownum;
    }

    private BigDecimal rownum;

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public BigDecimal getNumeric_col_1() {
        return numeric_col_1;
    }

    public void setNumeric_col_1(BigDecimal numeric_col_1) {
        this.numeric_col_1 = numeric_col_1;
    }

    public Timestamp getTimestamp_column() {
        return timestamp_column;
    }

    public void setTimestamp_column(Timestamp timestamp_column) {
        this.timestamp_column = timestamp_column;
    }

    public BigDecimal getRownum() {
        return rownum;
    }

    public void setRownum(BigDecimal rownum) {
        this.rownum = rownum;
    }
}
