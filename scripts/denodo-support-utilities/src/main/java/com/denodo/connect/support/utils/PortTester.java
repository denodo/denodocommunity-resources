package com.denodo.connect.support.utils;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;

public class PortTester {

    public static void main(String[] args) {

        if (args.length != 2 && args.length != 3 ) {

            System.out.println("Invalid parameters number");
            System.exit(-1);
        }

        System.out.println("Checking ports...");

        String host = args[0];
        String[] portList =  args[1].split(",");

        int timeout = 5;
        if(args.length == 3) {
            String timeoutIn = args[2];
            timeout = Integer.valueOf(timeoutIn).intValue();
        }

        for (int i = 0; i < portList.length; i++) {
            checkPort(host, portList[i], timeout);
        }
    }

    public static void checkPort(String host, String port, int timeout) {

        Socket s = null;
        String reason = null;
        try {
            s = new Socket();
            s.setReuseAddress(true);
            SocketAddress sa = new InetSocketAddress(host, Integer.parseInt(port));
            s.connect(sa, timeout * 1000);
        } catch (IOException e) {
            if (e.getMessage().equals("Connection refused")) {
                reason = "port " + port + " on " + host + " is closed.";
            }
            if (e instanceof UnknownHostException) {
                reason = "node " + host + " is unresolved.";
            }
            if (e instanceof SocketTimeoutException) {
                reason = "timeout while attempting to reach node " + host + " on port " + port;
            }
        } finally {
            if (s != null) {
                if (s.isConnected()) {
                    System.out.println("Port " + port + " on " + host + " is reachable!");
                } else {
                    System.out.print("Port " + port + " on " + host + " is not reachable");
                    if(reason != null) System.out.print("; reason: " + reason);
                    System.out.println("");
                }
                try {
                    s.close();
                } catch (IOException e) {
                }
            }
        }
    }
}
