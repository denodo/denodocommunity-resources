package com.denodo.connect.support.utils;


import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.Charset;
import java.util.Locale;

public class EncodingInfo {

    public EncodingInfo() {
    }

    public static void main(String args[]) {
        System.out.println("File encoding   : " + System.getProperty("file.encoding"));
        System.out.println("Byte encoding   : " + (new OutputStreamWriter(new ByteArrayOutputStream())).getEncoding());
        System.out.println("Default charset : " + Charset.defaultCharset().name());
        System.out.println("Default locale  : " + Locale.getDefault() + "\n");
    }
}
