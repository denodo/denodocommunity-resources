package com.denodo.springbatchkb.entity;

import java.math.BigDecimal;
import java.sql.Timestamp;

public class MyReadEntityPOJO {
    private int id;
    private String string_col_1;
    private BigDecimal numeric_col_1;
    private BigDecimal numeric_col_2;
    private Timestamp timestamp_column;

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

    public Timestamp getTimestamp_column() {
        return timestamp_column;
    }

    public void setTimestamp_column(Timestamp timestamp_column) {
        this.timestamp_column = timestamp_column;
    }
}
