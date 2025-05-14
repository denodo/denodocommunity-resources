package com.denodo.springbatchkb.entity;

import java.math.BigDecimal;
import java.sql.Timestamp;

public class MyWriteEntityAnalyticalPOJO {
    private int id;
    private BigDecimal numeric_col_1;

    private BigDecimal rownum;
    private Timestamp timestamp_column;

    public MyWriteEntityAnalyticalPOJO(int id, BigDecimal numeric_col_1, BigDecimal rownum, Timestamp timestamp_column) {
        this.id = id;
        this.numeric_col_1 = numeric_col_1;
        this.timestamp_column = timestamp_column;
        this.rownum = rownum;
    }

    public MyWriteEntityAnalyticalPOJO(MyReadEntityAnalyticalPOJO to_copy) {
        this.id = to_copy.getId();
        this.numeric_col_1 = to_copy.getNumeric_col_1();
        this.timestamp_column = to_copy.getTimestamp_column();
        this.rownum = to_copy.getRownum();
    }


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

    public BigDecimal getRownum() {
        return rownum;
    }

    public void setRownum(BigDecimal rownum) {
        this.rownum = rownum;
    }

    public Timestamp getTimestamp_column() {
        return timestamp_column;
    }

    public void setTimestamp_column(Timestamp timestamp_column) {
        this.timestamp_column = timestamp_column;
    }
}
