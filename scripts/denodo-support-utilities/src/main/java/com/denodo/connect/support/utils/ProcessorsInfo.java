package com.denodo.connect.support.utils;

public class ProcessorsInfo {

    public ProcessorsInfo() {
    }

    public static void main(String args[]) {
      int num_processors = Runtime.getRuntime().availableProcessors();
      System.out.println("Cores: " + num_processors + "\n");
    }
}
