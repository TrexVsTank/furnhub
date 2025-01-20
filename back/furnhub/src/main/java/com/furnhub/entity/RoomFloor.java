package com.furnhub.entity;

import java.time.LocalDateTime;

import jakarta.persistence.*;

@Entity
@Table(name = "room_floor")
public class RoomFloor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne
    @JoinColumn(name = "assets_floor_id", nullable = false)
    private AssetFloor floorAsset;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public AssetFloor getFloorAsset() {
        return floorAsset;
    }

    public void setFloorAsset(AssetFloor floorAsset) {
        this.floorAsset = floorAsset;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    // toString Method
    @Override
    public String toString() {
        return "RoomFloor{" +
                "id=" + id +
                ", room=" + room +
                ", floorAsset=" + floorAsset +
                ", createdAt=" + createdAt +
                '}';
    }
}
